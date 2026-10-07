import { SpocAllocation } from '../models/SpocAllocation.js';
import { Team } from '../models/Team.js';

const POP_EMP = 'firstName lastName empId designation department branch';

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
  const members = [...seen.values()];
  const committed = committedServices(project);
  const responsible = resolveResponsible({ project, teams, allocations, committed });
  return { project, teams, allocations, members, committed, responsible };
}

export function resolveResponsible({ project, teams, allocations, committed }) {
  const set = new Set((committed ?? []).map(normService));
  const smepf = ['structural', 'mechanical', 'electrical', 'plumbing', 'fire'];
  const hasAll = smepf.every((s) => set.has(s));
  const onlyStructural = set.size === 1 && set.has('structural');
  const hasStructural = set.has('structural');
  const mepOnly = set.size > 0 && !hasStructural;

  const spocEmp = allocations?.[0]?.coordinator ?? null;
  const spocName = empLabel(spocEmp);

  const leadOf = (serviceMatch) => {
    const t = (teams ?? []).find(
      (x) => normService(x.service) === normService(serviceMatch) && x.lead,
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
