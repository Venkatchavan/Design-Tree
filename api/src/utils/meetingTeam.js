import { SpocAllocation } from '../models/SpocAllocation.js';
import { Team } from '../models/Team.js';
import { User } from '../models/User.js';
import { Employee } from '../models/Employee.js';
import { expandServices } from '../config/services.js';

const POP_EMP = 'firstName lastName empId designation department branch experience';

function empLabel(e) {
  if (!e) return '';
  if (typeof e === 'string') return e;
  return (
    [e.firstName, e.lastName].filter(Boolean).join(' ') ||
    e.empId ||
    e.email ||
    ''
  );
}

function normService(s) {
  return String(s ?? '').trim().toLowerCase();
}

function committedServices(project) {
  const out = [];
  for (const s of project?.scope ?? []) {
    if (s?.service) out.push(s.service);
  }
  return expandServices([...out, ...(project?.services ?? [])]);
}

const BOARD_DIRECTOR_ROLES = ['founding_director', 'working_director', 'executive_director'];
const TEAM_DIRECTOR_ROLES = ['associate_director', 'technical_director', 'assoc_technical_director'];
const norm = (v) => String(v ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * Directors who can be invited to (and marked absent from) a project meeting:
 * every board director (founding / working / executive), plus a technical /
 * associate director named as the `director` of anyone on the project team.
 */
export async function projectDirectors(memberIds = []) {
  const users = await User.find({ role: { $in: [...BOARD_DIRECTOR_ROLES, ...TEAM_DIRECTOR_ROLES] }, employee: { $ne: null } })
    .select('role employee name email').lean();
  if (users.length === 0) return [];
  const employees = await Employee.find({ _id: { $in: users.map((u) => u.employee) }, status: { $ne: 'Exited' } })
    .select(POP_EMP + ' email').lean();
  const byId = new Map(employees.map((e) => [String(e._id), e]));
  const teamDirectorKeys = new Set();
  if (memberIds.length) {
    const members = await Employee.find({ _id: { $in: memberIds } }).select('director').lean();
    for (const m of members) if (m.director) teamDirectorKeys.add(norm(m.director));
  }
  const out = [];
  for (const u of users) {
    const e = byId.get(String(u.employee));
    if (!e) continue;
    if (BOARD_DIRECTOR_ROLES.includes(u.role)) { out.push(e); continue; }
    const keys = [e._id, e.empId, e.email, u.name, u.email, [e.firstName, e.lastName].filter(Boolean).join(' ')].map(norm);
    if (keys.some((k) => k && teamDirectorKeys.has(k))) out.push(e);
  }
  return out;
}

/**
 * Project team aggregation (decision 2A): members come from Teams
 * linked to the project via Team.projects. No separate meeting roster.
 * Returns deduped members + allocations + responsible (decision 3B).
 *
 * 3B rule with Team Lead mapping:
 * - full S+M+E+P+F -> SPOC (allocation coordinator)
 * - structural only -> Structural Team lead (Team Lead), fallback SPOC
 * - MEP-only (no structural) -> MEP Coordination Team lead if present,
 *   else first MEP service Team lead, fallback SPOC
 * - multiple (not full SMEPF) -> SPOC with service leads
 */
export async function projectTeamBundle(project) {
  const projectId = project._id;
  const [teams, allocations] = await Promise.all([
    Team.find({ projects: projectId })
      .populate('members.employee', POP_EMP)
      .populate('lead', POP_EMP)
      .lean(),
    SpocAllocation.find({ project: projectId })
      .populate('coordinator', POP_EMP)
      .lean(),
  ]);

  const seen = new Map();
  for (const t of teams) {
    const service = t.service ?? '';
    for (const m of t.members ?? []) {
      const e = m?.employee;
      if (!e || typeof e !== 'object' || !e._id) continue;
      const id = String(e._id);
      if (!seen.has(id)) {
        seen.set(id, {
          employee: e,
          service,
          team: t.name ?? '',
          allocation: m?.allocation ?? '',
        });
      }
    }
  }
  for (const t of teams) {
    const e = t.lead;
    if (e?._id && !seen.has(String(e._id))) seen.set(String(e._id), { employee: e, service: t.service, team: t.name, allocation: 'Team lead' });
  }
  for (const d of await projectDirectors([...seen.keys()])) {
    if (!seen.has(String(d._id))) seen.set(String(d._id), { employee: d, service: 'Directors', team: 'Directors', allocation: 'Director' });
  }
  const members = [...seen.values()];
  const committed = committedServices(project);
  const responsible = resolveResponsible({ project, teams, allocations, committed });
  return { project, teams, allocations, members, committed, responsible };
}

export function resolveResponsible({ project, teams, allocations, committed }) {
  const set = new Set(expandServices(committed).map(normService));
  const smepf = ['structural', 'mechanical', 'electrical', 'plumbing', 'fire'];
  const hasAll = smepf.every((s) => set.has(s));
  const onlyStructural = set.size === 1 && set.has('structural');
  const hasStructural = set.has('structural');
  const mepOnly = set.size > 0 && !hasStructural;

  const spocEmp = allocations?.[0]?.coordinator ?? null;
  const spocName = empLabel(spocEmp);

  const leadOf = (serviceMatch) => {
    const t = (teams ?? []).find(
      (x) => expandServices([x.service]).map(normService).includes(normService(serviceMatch)) && x.lead,
    );
    return t?.lead ?? null;
  };

  if (hasAll) {
    return {
      name: spocName,
      role: 'SPOC',
      reason: 'SMEPF services',
      label: spocName ? `${spocName} · SPOC (SMEPF services)` : 'Project SPOC (SMEPF services)',
    };
  }
  if (onlyStructural) {
    const lead = leadOf('structural');
    const name = empLabel(lead) || spocName;
    return {
      name,
      role: name && lead && empLabel(lead) === name ? 'Structural Design Lead' : 'Structural Design Lead / Design Team',
      reason: 'Structural services only',
      label: name ? `${name} · Structural Design Lead (Structural services only)` : 'Structural Design Lead (Structural services only)',
    };
  }
  if (mepOnly) {
    const mcLead = leadOf('mep coordination') ?? leadOf('mep') ?? leadOf('mechanical') ?? leadOf('electrical') ?? leadOf('plumbing') ?? leadOf('fire');
    const name = empLabel(mcLead) || spocName;
    const isMcTeam = (teams ?? []).some(
      (x) => normService(x.service).includes('mep') && x.lead && empLabel(x.lead) === name,
    );
    return {
      name,
      role: 'MEP Coordinator',
      reason: isMcTeam ? 'MEP Coordination services' : 'MEP services',
      label: name ? `${name} · MEP Coordinator` : 'MEP Coordinator',
    };
  }
  return {
    name: spocName,
    role: 'SPOC',
    reason: 'Multiple services',
    label: spocName ? `${spocName} · SPOC (Multiple services)` : 'Project SPOC with service leads',
  };
}
