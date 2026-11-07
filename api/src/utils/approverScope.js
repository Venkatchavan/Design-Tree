import { Employee } from '../models/Employee.js';
import { Project } from '../models/Project.js';
import { Team } from '../models/Team.js';
import { User } from '../models/User.js';
import { isSuperRole } from '../config/roles.js';
import { directorTeams, employeeOwnership, isTeamDirector } from './directorTeams.js';

// Who may approve / sees an employee's request (extra hours, Sunday work):
//  - the saved reporting chain (reportingManager / director links),
//  - a TL / Sr. TL / PTL: everyone in a team they lead and everyone in a team
//    working a project they are the approved Principal Team Lead of,
//  - an Associate / Technical / Assoc. Technical Director: the same chain plus
//    the teams they own through the Technical Director mapping,
//  - Founding / Working / Executive Directors: everyone.
// 07 Nov 2026: before this, only the saved reporting link counted, so a TL whose
// people were on their team but not linked as reportees never saw the request.
const APPROVER_ROLES = ['team_lead', 'associate_director', 'technical_director', 'assoc_technical_director', 'design_mgmt_head'];
const id = (v) => String(v?._id ?? v ?? '');

async function loadContext() {
  const [employees, users, teams, projects] = await Promise.all([
    Employee.find({ status: { $ne: 'Exited' } })
      .select('firstName middleName lastName empId email director reportingManager teamViewOf headOfDepartments department status').lean(),
    User.find({}).select('name email employee role').lean(),
    Team.find({ active: { $ne: false } }).select('lead members.employee projects').lean(),
    Project.find({ 'principalTeamLeads.0': { $exists: true } }).select('principalTeamLeads').lean(),
  ]);
  return { employees, users, teams, projects };
}

function scopeFor(user, ctx) {
  const { own, active, reporting } = employeeOwnership(user, ctx.employees, ctx.users);
  if (!active.has(own)) return new Set();
  const ids = new Set(reporting);
  if (user.role === 'team_lead') {
    const ptlProjects = new Set(ctx.projects
      .filter((p) => (p.principalTeamLeads ?? []).some((t) => id(t.employee) === own && t.approvalStatus !== 'Proposed'))
      .map(id));
    for (const t of ctx.teams) {
      const led = id(t.lead) === own;
      const ptl = (t.projects ?? []).some((p) => ptlProjects.has(id(p)));
      if (!led && !ptl) continue;
      for (const m of t.members ?? []) ids.add(id(m.employee));
    }
  }
  ids.delete(own);
  return ids;
}

// { all: true } for the Founding / Working / Executive Directors, otherwise the
// employee ids this approver can act for.
export async function approverScope(user) {
  if (isSuperRole(user?.role)) return { all: true, ids: null };
  const ctx = await loadContext();
  const ids = scopeFor(user, ctx);
  if (isTeamDirector(user)) {
    for (const t of (await directorTeams(user)) ?? []) {
      if (t.lead) ids.add(id(t.lead));
      for (const m of t.members ?? []) ids.add(id(m.employee));
    }
    const me = ctx.users.find((u) => id(u) === id(user.id));
    ids.delete(id(me?.employee));
  }
  return { all: false, ids: [...ids] };
}

// Login ids of the TL / PTL / director who should be told about a request from
// this employee (the Founding / Working / Executive Directors are notified by role).
export async function approverUserIdsFor(employeeId) {
  const ctx = await loadContext();
  const target = id(employeeId);
  return ctx.users
    .filter((u) => APPROVER_ROLES.includes(u.role) && id(u.employee) !== target)
    .filter((u) => scopeFor({ id: id(u), role: u.role }, ctx).has(target))
    .map((u) => id(u));
}
