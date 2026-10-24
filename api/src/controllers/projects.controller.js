import { Team } from '../models/Team.js';
import { Employee } from '../models/Employee.js';
import { User } from '../models/User.js';
import { expandServices } from '../config/services.js';
import {
  PROJECT_STATUSES,
  Project,
  SERVICES,
  STAGES,
} from '../models/Project.js';
import {
  activateProjectSchema,
  finalApprovalSchema,
  projectSchema,
  projectUpdateSchema,
  projectHoldSchema,
  spocContactsSchema,
  teamConfirmationSchema,
  teamLeadsSchema,
} from '../validation/project.schema.js';
import { requireActiveBranch } from '../utils/branches.js';
import { projectScopeIds } from '../utils/projectScope.js';

async function projectVisible(user, id) {
  const ids = await projectScopeIds(user);
  return !ids || ids.includes(String(id));
}

// Only Admin/Billing may create/import projects (FD/WD superusers bypass via requireRole §3.4).
const CREATOR_ROLES = ['admin_billing'];

export { CREATOR_ROLES };

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function syncProjectLeadTeams(project) {
  const groups = new Map();
  const unresolvedServices = new Set((project.principalTeamLeads ?? [])
    .filter(row => !row.employee && row.approvalStatus !== 'Proposed' && (row.name || row.names?.length))
    .map(row => expandServices([row.service]).join(' + ') || row.service));
  for (const row of project.principalTeamLeads ?? []) {
    if (!row.employee || row.approvalStatus === 'Proposed') continue;
    const service = expandServices([row.service]).join(' + ') || row.service;
    if (!service || unresolvedServices.has(service)) continue;
    if (!groups.has(service)) groups.set(service, []);
    groups.get(service).push(row);
  }
  for (const [service, rows] of groups) {
    const ids = [...new Set(rows.map((row) => String(row.employee)))];
    const leads = await User.find({ employee: { $in: ids }, role: 'team_lead' }).select('employee').lean();
    const lead = leads[0]?.employee;
    await Team.findOneAndUpdate(
      { allocationProject: project._id, allocationService: service },
      {
        $set: {
          name: `${project.code || project.name} - ${service}`,
          service,
          branch: project.branch,
          lead: lead || null,
          projects: [project._id],
          members: ids
            .filter((id) => String(lead) !== id)
            .map((employee) => ({ employee, allocation: 'Approved project allocation' })),
          active: true,
        },
      },
      { upsert: true, returnDocument: 'after', runValidators: true },
    );
  }
  await Team.updateMany(
    { allocationProject: project._id, allocationService: { $nin: [...groups.keys(), ...unresolvedServices] } },
    { $set: { active: false, projects: [] } },
  );
}

// Older nominations stored names only. Resolve an exact, unique employee name;
// ambiguous names remain visible for the SPOC to correct instead of guessing.
async function resolveAllocationNames(rows) {
  const normalized = value => String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
  const employees = await Employee.find({ status: { $ne: 'Exited' } }).select('firstName middleName lastName empId').lean();
  const warnings = [];
  const expanded = rows.flatMap(original => {
    const row = original.toObject ? original.toObject() : { ...original };
    return row.names?.length ? row.names.map(name => ({ ...row, name, names: [], employee: row.names.length === 1 ? row.employee : undefined })) : [row];
  });
  const resolved = expanded.map(original => {
    const row = original.toObject ? original.toObject() : { ...original };
    if (row.employee || row.approvalStatus === 'Proposed' || !row.name) return row;
    const name = normalized(row.name);
    const matches = employees.filter(e => [e.empId, [e.firstName, e.lastName].filter(Boolean).join(' '),
      [e.firstName, e.middleName, e.lastName].filter(Boolean).join(' ')].some(value => normalized(value) === name));
    if (matches.length === 1) row.employee = matches[0]._id;
    else warnings.push(`${row.name}: ${matches.length ? 'multiple employees match; choose an employee' : 'no employee match; choose an employee'}.`);
    return row;
  });
  return { rows: resolved, warnings };
}

export async function reconcileProjectTeam(req, res, next) {
  try {
    if (!await projectVisible(req.user, req.params.id)) return res.status(404).json({ message: 'Project not found.' });
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found.' });
    const resolved = await resolveAllocationNames(project.principalTeamLeads ?? []);
    project.principalTeamLeads = resolved.rows;
    await project.save();
    await syncProjectLeadTeams(project);
    return res.json({ project, allocationWarnings: resolved.warnings });
  } catch (err) { return next(err); }
}

// Admin-only sequential identifiers for the New Project form, initialized
// above the highest existing value for the year so collisions are avoided.
async function nextSequence(name, usedCodes) {
  let max = 0;
  for (const code of usedCodes) {
    const m = /-(\d+)$/.exec(String(code ?? ''));
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  const { Counter } = await import('../models/Counter.js');
  await Counter.findOneAndUpdate(
    { name },
    { $max: { seq: max } },
    { upsert: true },
  );
  const doc = await Counter.findOneAndUpdate(
    { name },
    { $inc: { seq: 1 } },
    { new: true, returnDocument: 'after' },
  );
  return doc.seq;
}

export async function nextProjectCode(_req, res, next) {
  try {
    const code = await generateProjectCode();
    return res.status(200).json({ code });
  } catch (err) {
    return next(err);
  }
}

export async function nextJobNumber(_req, res, next) {
  try {
    const jobNumber = await generateJobNumber();
    return res.status(200).json({ jobNumber });
  } catch (err) {
    return next(err);
  }
}

async function generateProjectCode() {
  const year = new Date().getFullYear();
  const existing = await Project.find({ code: new RegExp(`^PRJ-${year}-\\d+$`) }).select('code').lean();
  const seq = await nextSequence(`project-code-${year}`, existing.map((p) => p.code));
  return `PRJ-${year}-${String(seq).padStart(3, '0')}`;
}

async function generateJobNumber() {
  const year = new Date().getFullYear();
  const existing = await Project.find({ jobNumber: new RegExp(`^WO/${year}/\\d+$`) }).select('jobNumber').lean();
  const seq = await nextSequence(`job-number-${year}`, existing.map((p) => p.jobNumber));
  return `WO/${year}/${String(seq).padStart(4, '0')}`;
}

export async function listProjects(req, res, next) {
  try {
    const { branch, service, stage, status, search } = req.query;
    const filter = {};
    const scopeIds = await projectScopeIds(req.user);
    if (scopeIds) filter._id = { $in: scopeIds };
    if (branch) filter.branch = branch;
    if (stage) filter.currentStage = stage;
    if (status) filter.status = status;
    if (service) filter.$or = [{ 'scope.service': service }, { services: service }];
    if (search) {
      const rx = new RegExp(escapeRegExp(search), 'i');
      filter.$or = [...(filter.$or ?? []), { name: rx }, { code: rx }, { clientName: rx }];
      // When both service + search are present $or mixes conditions; nest service part.
      if (service && search) {
        filter.$and = [
          { $or: [{ 'scope.service': service }, { services: service }] },
          { $or: [{ name: rx }, { code: rx }, { clientName: rx }] },
        ];
        delete filter.$or;
      }
    }
    const [items, total] = await Promise.all([
      Project.find(filter).sort({ updatedAt: -1 }).limit(200),
      Project.countDocuments(filter),
    ]);
    return res.status(200).json({ items, total });
  } catch (err) {
    return next(err);
  }
}

export async function projectSummary(req, res, next) {
  try {
    const ids = await projectScopeIds(req.user);
    const filter = ids ? { _id: { $in: ids } } : {};
    if (req.query.branch) filter.branch = req.query.branch;
    if (req.query.service) filter.$or = [{ services: req.query.service }, { 'scope.service': req.query.service }];
    if (req.query.search) {
      const rx = new RegExp(escapeRegExp(req.query.search), 'i');
      filter.$and = [{ $or: [{ name: rx }, { code: rx }, { clientName: rx }] }];
    }
    const items = await Project.find(filter).select('name code status currentStage').sort({ name: 1 }).lean();
    return res.json({ items, total: items.length });
  } catch (err) { return next(err); }
}

export async function projectStats(req, res, next) {
  try {
    const scopeIds = await projectScopeIds(req.user);
    const projects = await Project.find(
      scopeIds ? { _id: { $in: scopeIds } } : {},
      { status: 1, completion: 1, branch: 1, currentStage: 1, scope: 1, services: 1 },
    );
    const counts = { active: 0, completed: 0, onHold: 0 };
    const byBranch = new Map();
    const byStage = new Map();
    const byBranchStage = new Map();
    const byService = new Map();
    for (const p of projects) {
      if (p.status === 'Active') counts.active += 1;
      else if (p.status === 'Completed') counts.completed += 1;
      else if (p.status === 'On Hold') counts.onHold += 1;
      const b = byBranch.get(p.branch) ?? { projects: 0, completionSum: 0 };
      b.projects += 1;
      b.completionSum += p.completion ?? 0;
      byBranch.set(p.branch, b);
      byStage.set(p.currentStage, (byStage.get(p.currentStage) ?? 0) + 1);
      if (p.branch) {
        const branchStages = byBranchStage.get(p.branch) ?? new Map();
        branchStages.set(p.currentStage, (branchStages.get(p.currentStage) ?? 0) + 1);
        byBranchStage.set(p.branch, branchStages);
      }
      for (const s of p.scope ?? []) {
        if (s.service) byService.set(s.service, (byService.get(s.service) ?? 0) + 1);
      }
      for (const s of p.services ?? []) {
        if (s) byService.set(s, (byService.get(s) ?? 0) + 1);
      }
    }
    return res.status(200).json({
      counts,
      branches: [...byBranch.entries()].map(([branch, v]) => ({
        branch,
        projects: v.projects,
        avgCompletion:
          v.projects === 0 ? 0 : Math.round(v.completionSum / v.projects),
      })),
      byStage: [...byStage.entries()].map(([stage, count]) => ({
        stage,
        count,
      })),
      byBranchStage: Object.fromEntries(
        [...byBranchStage.entries()].map(([branch, stages]) => [
          branch,
          [...stages.entries()].map(([stage, count]) => ({ stage, count })),
        ]),
      ),
      services: [...byService.entries()].map(([service, projects]) => ({
        service,
        projects,
      })),
      totals: { projects: projects.length, branches: byBranch.size },
    });
  } catch (err) {
    return next(err);
  }
}

export async function projectFilters(_req, res, next) {
  try {
    const scopeIds = await projectScopeIds(_req.user);
    const scope = scopeIds ? { _id: { $in: scopeIds } } : {};
    const [branches, statuses] = await Promise.all([
      Project.distinct('branch', scope),
      Project.distinct('status', scope),
    ]);
    const { branchOptionsWithLegacy } = await import('../utils/branches.js');
    return res.status(200).json({
      branches: await branchOptionsWithLegacy(branches),
      services: SERVICES,
      stages: STAGES,
      statuses: statuses.length > 0 ? statuses.sort() : PROJECT_STATUSES,
    });
  } catch (err) {
    return next(err);
  }
}

export async function getProject(req, res, next) {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found.' });
    if (!(await projectVisible(req.user, project._id))) return res.status(404).json({ message: 'Project not found.' });
    return res.status(200).json({ project });
  } catch (err) {
    return next(err);
  }
}

// SPOC Meetings §7 / decision 2A: team members come from Teams linked to
// the project. Empty list yields an empty-state on the client.
export async function getProjectTeam(req, res, next) {
  try {
    const { projectTeamBundle } = await import('../utils/meetingTeam.js');
    const project = await Project.findById(req.params.id).lean();
    if (!project) return res.status(404).json({ message: 'Project not found.' });
    if (!(await projectVisible(req.user, project._id))) return res.status(404).json({ message: 'Project not found.' });
    const bundle = await projectTeamBundle(project);
    return res.status(200).json({
      project: {
        _id: project._id,
        name: project.name,
        code: project.code,
        clientName: project.clientName ?? project.contacts?.client?.company ?? '',
        scope: project.scope ?? [],
      },
      committedServices: bundle.committed,
      responsible: bundle.responsible,
      members: bundle.members.map((m) => ({
        employee: m.employee,
        service: m.service,
        team: m.team,
      })),
      allocations: (bundle.allocations ?? []).map((a) => ({
        project: project._id,
        coordinator: a.coordinator,
        services: a.services ?? [],
        status: a.status,
      })),
    });
  } catch (err) {
    return next(err);
  }
}

function validationIssues(error) {
  return (error?.issues ?? []).map((i) => ({
    path: Array.isArray(i.path) ? i.path.join('.') : String(i.path ?? ''),
    message: i.message,
    code: i.code,
  }));
}

export async function createProject(req, res, next) {
  try {
    const parsed = projectSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: 'Invalid project data.', issues: validationIssues(parsed.error) });
    }
    if (parsed.data.branch) {
      try {
        parsed.data.branch = await requireActiveBranch(parsed.data.branch);
      } catch (err) {
        return res.status(err.status ?? 400).json({ message: err.message });
      }
    }
    for (const row of parsed.data.principalTeamLeads ?? []) {
      if (!row.employee) continue;
      const employee = await Employee.findById(row.employee);
      if (!employee) return res.status(400).json({ message: 'Choose a valid team lead.' });
      row.name = [employee.firstName, employee.lastName].filter(Boolean).join(' ') || employee.empId;
    }
    if(parsed.data.contacts?.pmc || parsed.data.contacts?.peerReview) return res.status(400).json({message:'PMC and Peer Review contacts are maintained by the assigned SPOC.'});
    const selectedSpoc = parsed.data.activation?.spoc;
    if (selectedSpoc && !(await Employee.exists({ _id: selectedSpoc }))) {
      return res.status(400).json({ message: 'Choose a valid SPOC.' });
    }
    const code = (parsed.data.code?.trim() || await generateProjectCode()).toUpperCase();
    const jobNumber = parsed.data.jobNumber?.trim() || await generateJobNumber();
    const activationStatus = parsed.data.activation?.status ?? 'Pending';
    const project = await Project.create({
      ...parsed.data,
      origin: 'admin_billing', createdBy: req.user.id,
      code,
      jobNumber,
      services: parsed.data.services ?? [],
      activation: {
        ...(parsed.data.activation ?? {}),
        status: activationStatus,
        ...(activationStatus === 'Activated'
          ? { activatedBy: req.user.id, activatedAt: new Date() }
          : {}),
      },
    });
    if (project.principalTeamLeads?.some((row) => row.employee && row.approvalStatus !== 'Proposed')) {
      await syncProjectLeadTeams(project);
    }
    if (selectedSpoc) {
      const { SpocAllocation } = await import('../models/SpocAllocation.js');
      await SpocAllocation.findOneAndUpdate(
        { project: project._id, coordinator: selectedSpoc },
        {
          project: project._id,
          coordinator: selectedSpoc,
          services: parsed.data.services ?? [],
          status: 'Proposed',
          createdBy: req.user.id,
        },
        { upsert: true, new: true, returnDocument: 'after', runValidators: true },
      );
    }
    // Best-effort post-creation wiring: seed the 16-step design workflow
    // so the Design Management Head has something to open, and notify the
    // DMH + Technical Directors that a new project needs review.
    try {
      const { DesignWorkflow } = await import('../models/DesignWorkflow.js');
      await DesignWorkflow.findOneAndUpdate(
        { project: project._id },
        { $setOnInsert: { project: project._id, steps: [], matrix: [] } },
        { upsert: true },
      );
      const { notify } = await import('../models/Notification.js');
      await notify({
        roles: ['design_mgmt_head', 'technical_director'],
        project: project._id,
        link: { view: 'design-mgmt', id: project._id.toString() },
        title: `New project: ${project.name} (${project.code})`,
        detail: 'Review scope & requirements and identify required disciplines.',
        type: 'project-created',
      });
    } catch {
      /* creation itself succeeded — wiring is best-effort */
    }
    return res.status(201).json({ project });
  } catch (err) {
    if (err?.code === 11000) {
      return res
        .status(409)
        .json({ message: 'A project with this code already exists.' });
    }
    return next(err);
  }
}

export async function updateProject(req, res, next) {
  try {
    const parsed = projectUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: 'Invalid project data.', issues: validationIssues(parsed.error) });
    }
    if (parsed.data.branch !== undefined) {
      try {
        parsed.data.branch = await requireActiveBranch(parsed.data.branch);
      } catch (err) {
        return res.status(err.status ?? 400).json({ message: err.message });
      }
    }
    if (parsed.data.code) parsed.data.code = parsed.data.code.toUpperCase();
    const update={...parsed.data};
    if(update.contacts){
      if(Object.hasOwn(update.contacts,'pmc')||Object.hasOwn(update.contacts,'peerReview'))return res.status(403).json({message:'Use the SPOC contact workflow.'});
      for(const [key,value]of Object.entries(update.contacts))update['contacts.'+key]=value;
      delete update.contacts;
    }
    const project = await Project.findByIdAndUpdate(req.params.id, {$set:update}, {
      new: true,
      returnDocument: 'after',
      runValidators: true,
    });
    if (!project) return res.status(404).json({ message: 'Project not found.' });
    return res.status(200).json({ project });
  } catch (err) {
    if (err?.code === 11000) {
      return res
        .status(409)
        .json({ message: 'A project with this code already exists.' });
    }
    return next(err);
  }
}

export async function updateProjectHold(req, res, next) {
  try {
    const parsed = projectHoldSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Choose a status and enter a reason.' });
    const me = await User.findById(req.user.id).select('employee').lean();
    const { SpocAllocation } = await import('../models/SpocAllocation.js');
    const assigned = me?.employee && await SpocAllocation.exists({
      project: req.params.id, coordinator: me.employee, status: 'Approved',
    });
    if (!assigned) return res.status(404).json({ message: 'Project not found.' });
    const previous = await Project.findById(req.params.id).lean();
    if (!previous) return res.status(404).json({ message: 'Project not found.' });
    if (!['Active', 'On Hold'].includes(previous.status)) {
      return res.status(409).json({ message: 'Only active or held projects can use this action. Completed projects stay completed.' });
    }
    const at = new Date(), { status, reason } = parsed.data;
    const project = await Project.findOneAndUpdate(
      { _id: previous._id, status: previous.status, updatedAt: previous.updatedAt },
      { $set: { status, 'hold.reason': reason, 'hold.updatedBy': req.user.id, 'hold.updatedAt': at },
        $push: { 'hold.history': { from: previous.status, to: status, reason, by: req.user.id, at } } },
      { returnDocument: 'after', runValidators: true },
    );
    if (!project) return res.status(409).json({ message: 'Project changed. Refresh before saving its status.' });
    try {
      const { notify, userIdsForEmployees } = await import('../models/Notification.js');
      const teams = await Team.find({ projects: project._id, active: { $ne: false } }).select('lead members').lean();
      const users = await userIdsForEmployees(teams.flatMap(t => [t.lead, ...(t.members ?? []).map(m => m.employee)]));
      await notify({ project: project._id, users, roles: ['design_mgmt_head'],
        title: `${project.name}: ${status}`, detail: reason, type: 'project-status',
        link: { view: 'project-detail', id: String(project._id) } });
    } catch { /* Saved status remains available through normal query refresh. */ }
    return res.json({ project });
  } catch (err) { return next(err); }
}

// PUT /api/projects/:id/spoc-contacts — SPOC-owned PMC / Peer Review
// contacts (admin does not know these; no link with directory sections).
export async function saveSpocContacts(req, res, next) {
  try {
    if (!(await projectVisible(req.user, req.params.id))) return res.status(404).json({ message: 'Project not found.' });
    const parsed = spocContactsSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: 'Invalid contacts data.', issues: validationIssues(parsed.error) });
    }
    if (parsed.data.pmc === undefined && parsed.data.peerReview === undefined) {
      return res.status(400).json({ message: 'Provide pmc and/or peerReview.' });
    }
    const set = {};
    if (parsed.data.pmc !== undefined) set['contacts.pmc'] = parsed.data.pmc;
    if (parsed.data.peerReview !== undefined) set['contacts.peerReview'] = parsed.data.peerReview;
    const project = await Project.findByIdAndUpdate(req.params.id, { $set: set }, {
      new: true,
      returnDocument: 'after',
      runValidators: true,
    });
    if (!project) return res.status(404).json({ message: 'Project not found.' });
    try {
      const { notify } = await import('../models/Notification.js');
      const saved = [
        parsed.data.pmc !== undefined ? 'PMC' : '',
        parsed.data.peerReview !== undefined ? 'Peer Review' : '',
      ].filter(Boolean).join(' + ');
      await notify({
        roles: ['admin_billing', 'design_mgmt_head'],
        project: project._id,
        link: { view: 'dashboard', id: project._id.toString() },
        title: `Contacts updated: ${project.name} (${project.code})`,
        detail: `SPOC saved ${saved} contact details.`,
        type: 'spoc-contacts',
      });
    } catch {
      /* best-effort */
    }
    return res.status(200).json({ project });
  } catch (err) {
    return next(err);
  }
}

// PUT /api/projects/:id/team-leads — SPOC-owned principal team leads
// (+ optional related director/head). Admin side is display-only.
// Multiple people per service supported via repeated rows or names[].
export async function saveTeamLeads(req, res, next) {
  try {
    if (!(await projectVisible(req.user, req.params.id))) return res.status(404).json({ message: 'Project not found.' });
    const parsed = teamLeadsSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: 'Invalid team leads data.', issues: validationIssues(parsed.error) });
    }
    const set = {};
    if (parsed.data.principalTeamLeads !== undefined) {
      const rows = [];
      for (const t of parsed.data.principalTeamLeads) {
        const service = (t.service ?? '').trim();
        const single = (t.name ?? '').trim();
        const multi = (t.names ?? []).map((n) => String(n ?? '').trim()).filter(Boolean);
        const extra = {
          ...(t.employee ? {employee:t.employee} : {}),
          ...(t.role?.trim() ? { role: t.role.trim() } : {}),
          ...(t.nominatedBy?.trim() ? { nominatedBy: t.nominatedBy.trim() } : {}),
          ...(t.approvalStatus ? { approvalStatus: t.approvalStatus } : {}),
        };
        if (single) rows.push({ service, name: single, ...extra });
        for (const n of multi) rows.push({ service, name: n, ...extra });
        if (!single && multi.length === 0 && service) rows.push({ service, name: '', ...extra });
      }
      set.principalTeamLeads = rows.filter((t) => (t.service ?? '').trim() || (t.name ?? '').trim());
    }
    for (const k of [
      'projectDirector',
      'projectDirectorDesignation',
      'projectHead',
      'projectHeadDesignation',
    ]) {
      const v = parsed.data.related?.[k];
      if (v !== undefined) set[`related.${k}`] = v;
    }
    if (Object.keys(set).length === 0) {
      return res.status(400).json({ message: 'Provide principalTeamLeads and/or related.' });
    }
    for (const row of set.principalTeamLeads ?? []) {
      if (row.employee) {
        const employee = await Employee.findById(row.employee);
        if (!employee) return res.status(400).json({message:'Choose a valid employee.'});
        row.name = [employee.firstName,employee.lastName].filter(Boolean).join(' ') || employee.empId;
      }
    }
    const allocation = set.principalTeamLeads ? await resolveAllocationNames(set.principalTeamLeads) : null;
    if (allocation) set.principalTeamLeads = allocation.rows;
    const project = await Project.findByIdAndUpdate(req.params.id, { $set: set }, {
      new: true,
      returnDocument: 'after',
      runValidators: true,
    });
    if (!project) return res.status(404).json({ message: 'Project not found.' });
    if (set.principalTeamLeads) await syncProjectLeadTeams(project);
    try {
      const { notify } = await import('../models/Notification.js');
      const names = (project.principalTeamLeads ?? [])
        .map((t) => t?.name)
        .filter(Boolean)
        .join(', ');
      await notify({
        roles: ['admin_billing', 'design_mgmt_head'],
        project: project._id,
        link: { view: 'dashboard', id: project._id.toString() },
        title: `Team leads: ${project.name} (${project.code})`,
        detail: names ? `SPOC set team leads: ${names}.` : 'SPOC updated the project team.',
        type: 'team-leads',
      });
    } catch {
      /* best-effort */
    }
    return res.status(200).json({ project, allocationWarnings: allocation?.warnings ?? [] });
  } catch (err) {
    return next(err);
  }
}

// POST /api/projects/:id/activate — Admin or Technical Director activates the
// project and assigns the confirmed SPOC. Idempotent: re-activation re-confirms/assigns.
export async function activateProject(req, res, next) {
  try {
    const parsed = activateProjectSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid activation data.' });
    }
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found.' });

    let allocation = null;
    const coordinatorId = parsed.data.coordinator ?? project.activation?.spoc?.toString();
    if (coordinatorId) {
      const coordinator = await Employee.findById(coordinatorId);
      if (!coordinator) {
        return res.status(400).json({ message: 'Coordinator not found.' });
      }
      const { SpocAllocation } = await import('../models/SpocAllocation.js');
      allocation = await SpocAllocation.findOneAndUpdate(
        { project: project._id, coordinator: coordinator._id },
        {
          project: project._id,
          coordinator: coordinator._id,
          services: parsed.data.services ?? project.services ?? [],
          status: 'Approved',
          createdBy: req.user.id,
        },
        { upsert: true, new: true, returnDocument: 'after', runValidators: true },
      );
    }

    project.status = 'Active';
    project.activation = {
      ...(project.activation?.toObject?.() ?? project.activation ?? {}),
      status: 'Activated',
      activatedBy: req.user.id,
      activatedAt: new Date(),
      spoc: coordinatorId ?? project.activation?.spoc,
    };
    await project.save();

    try {
      const { notify, userIdsForEmployees } = await import('../models/Notification.js');
      const users = coordinatorId
        ? await userIdsForEmployees([coordinatorId])
        : [];
      await notify({
        roles: ['design_mgmt_head', 'coordinator'],
        users,
        project: project._id,
        link: { view: 'my-coordination', id: project._id.toString() },
        title: `Project activated: ${project.name} (${project.code})`,
        detail: 'SPOC workspace is live.',
        type: 'project-activated',
      });
    } catch {
      /* best-effort */
    }
    return res.status(200).json({ project, allocation });
  } catch (err) {
    return next(err);
  }
}

// PUT /api/projects/:id/team-confirmation — DMH confirms discipline teams
// and optionally shares the details back to Admin.
export async function saveTeamConfirmation(req, res, next) {
  try {
    const parsed = teamConfirmationSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid team data.' });
    }
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found.' });

    const current = project.teamConfirmation?.toObject?.() ?? {};
    const status = parsed.data.status ?? current.status ?? 'Pending';
    const disciplines = parsed.data.disciplines ?? current.disciplines ?? [];
    if (parsed.data.sharedToAdmin && (status !== 'Confirmed' || disciplines.length === 0)) {
      return res.status(400).json({ message: 'Confirm the team with at least one discipline before sharing to Admin.' });
    }
    project.teamConfirmation = {
      ...current,
      status,
      disciplines,
    };
    if (status === 'Confirmed' && !current.confirmedAt) {
      project.teamConfirmation.confirmedBy = req.user.id;
      project.teamConfirmation.confirmedAt = new Date();
    }
    if (parsed.data.sharedToAdmin) {
      project.teamConfirmation.sharedToAdminAt = new Date();
    }
    await project.save();

    if (parsed.data.sharedToAdmin) {
      try {
        const { notify } = await import('../models/Notification.js');
        await notify({
          roles: ['admin_billing', 'coordinator', 'executive_director', 'associate_director', 'technical_director', 'assoc_technical_director'],
          project: project._id,
          link: { view: 'dashboard', id: project._id.toString() },
          title: `Team confirmed: ${project.name} (${project.code})`,
          detail: 'Design Management Head shared the confirmed project team to Admin, SPOC and Management.',
          type: 'team-confirmed',
        });
      } catch {
        /* best-effort */
      }
    }
    return res.status(200).json({ project });
  } catch (err) {
    return next(err);
  }
}

// POST /api/projects/:id/final-approval — director sign-off before GFC.
export async function recordFinalApproval(req, res, next) {
  try {
    const parsed = finalApprovalSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid approval data.' });
    }
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found.' });
    project.finalApproval = {
      ...(project.finalApproval?.toObject?.() ?? {}),
      status: 'Approved',
      approvedBy: req.user.id,
      approvedAt: new Date(),
      remarks: parsed.data.remarks,
    };
    await project.save();
    try {
      const { notify } = await import('../models/Notification.js');
      await notify({
        roles: ['admin_billing', 'design_mgmt_head'],
        project: project._id,
        link: { view: 'dashboard', id: project._id.toString() },
        title: `Final approval: ${project.name} (${project.code})`,
        detail: 'Approved for GFC submission.',
        type: 'final-approval',
      });
    } catch {
      /* best-effort */
    }
    return res.status(200).json({ project });
  } catch (err) {
    return next(err);
  }
}

// GET /api/projects/:id/gfc-readiness — checklist across deliverables,
// revisions, peer reviews, RFIs, QS/BOQ before final approval + GFC issue.
export async function gfcReadiness(req, res, next) {
  try {
    if (!(await projectVisible(req.user, req.params.id))) return res.status(404).json({ message: 'Project not found.' });
    const project = await Project.findById(req.params.id).lean();
    if (!project) return res.status(404).json({ message: 'Project not found.' });
    const pid = project._id;
    const [
      { Deliverable },
      { Revision },
      { PeerReview },
      { Rfi },
      { AreaSettlement },
      { BoqItem },
      { Drawing },
      { Transmittal },
    ] = await Promise.all([
      import('../models/Deliverable.js'),
      import('../models/Revision.js'),
      import('../models/PeerReview.js'),
      import('../models/Rfi.js'),
      import('../models/AreaSettlement.js'),
      import('../models/BoqItem.js'),
      import('../models/Drawing.js'),
      import('../models/Transmittal.js'),
    ]);
    const gfcDrawingIds = await Drawing.find({ project: pid, stage: 'GFC' }).distinct('_id');
    const [
      deliverablesOpen,
      revisionsOpen,
      peerOpen,
      peerCommentsOpen,
      rfisOpen,
      areaPending,
      boqPending,
      gfcTransmittals,
    ] = await Promise.all([
      Deliverable.countDocuments({ project: pid, status: { $ne: 'Approved' } }),
      Revision.countDocuments({ project: pid, status: { $ne: 'Cleared' } }),
      PeerReview.countDocuments({ project: pid, status: { $ne: 'Approved for Issue' } }),
      PeerReview.aggregate([
        { $match: { project: pid } },
        { $unwind: '$comments' },
        { $match: { 'comments.closureStatus': 'Open' } },
        { $count: 'n' },
      ]).then((r) => r[0]?.n ?? 0),
      Rfi.countDocuments({ project: pid, status: 'Open' }),
      AreaSettlement.countDocuments({ project: pid, status: 'Pending' }),
      BoqItem.countDocuments({ project: pid, status: { $ne: 'Approved' } }),
      // Transmittals reference drawings (no project field): count
      // Sent/Acknowledged transmittals over this project's GFC drawings.
      Transmittal.countDocuments({
        drawing: { $in: gfcDrawingIds },
        status: { $in: ['Sent', 'Acknowledged'] },
      }),
    ]);
    const checks = [
      { key: 'deliverables', label: 'Deliverables approved', open: deliverablesOpen, blocking: true },
      { key: 'revisions', label: 'Revisions cleared', open: revisionsOpen, blocking: true },
      { key: 'peer-review', label: 'Peer reviews approved for issue', open: peerOpen, blocking: true },
      { key: 'peer-comments', label: 'Peer review comments closed', open: peerCommentsOpen, blocking: true },
      { key: 'rfis', label: 'RFIs closed', open: rfisOpen, blocking: true },
      { key: 'area-settlement', label: 'Area settlements reviewed', open: areaPending, blocking: true },
      { key: 'boq', label: 'BOQ items approved', open: boqPending, blocking: true },
      { key: 'gfc-transmittal', label: 'GFC transmittals sent', open: 0, count: gfcTransmittals, blocking: false },
    ];
    const ready = checks.filter((c) => c.blocking).every((c) => c.open === 0);
    return res.status(200).json({
      project: { _id: project._id, name: project.name, code: project.code },
      finalApproval: project.finalApproval ?? { status: 'Pending' },
      checks,
      ready,
    });
  } catch (err) {
    return next(err);
  }
}
