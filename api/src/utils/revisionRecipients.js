// 13 Nov 2026: automated revision notifications, service-wise and project-wise.
// A revision for service S on project P notifies P's S-service PTL, ATD, TD and
// AD; Executive Directors and Founding Directors get every revision.
//
// Project-specific heads are found from the project's own teams for that
// service: each team lead's saved reporting chain (reportingManager / director
// links) is walked upwards, and the service's technical director recorded on
// the project's service dashboard is added.
import { Employee } from '../models/Employee.js';
import { User } from '../models/User.js';
import { Team } from '../models/Team.js';
import { ServiceDashboard } from '../models/ServiceDashboard.js';
import { expandServices, expandServiceCodes } from '../config/services.js';

const id = (v) => String(v?._id ?? v ?? '');
const norm = (v) => String(v ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
const fullName = (e) => [e?.firstName, e?.middleName, e?.lastName].filter(Boolean).join(' ');

const ROLE_LABEL = {
  assoc_technical_director: 'ATD',
  technical_director: 'TD',
  associate_director: 'AD',
  executive_director: 'ED',
  founding_director: 'Founding Director',
};

function headLabel(employee, role) {
  if (ROLE_LABEL[role]) return ROLE_LABEL[role];
  const d = String(employee?.designation ?? '');
  if (/associate\s+technical\s+director/i.test(d)) return 'ATD';
  if (/technical\s+director/i.test(d)) return 'TD';
  if (/associate\s+director/i.test(d)) return 'AD';
  if (/principal\s+team\s+lead|\bptl\b/i.test(d)) return 'PTL';
  return null;
}

// services: individual service names (Structural, Electrical, …) or codes.
export async function revisionRecipients(projectId, services = []) {
  const wanted = expandServices(services);
  const [employees, users, teams, dashboards] = await Promise.all([
    Employee.find({ status: { $ne: 'Exited' } }).select('firstName middleName lastName empId email designation department reportingManager director').lean(),
    User.find({ isActive: { $ne: false } }).select('name email role employee').lean(),
    Team.find({ projects: projectId, active: { $ne: false } }).select('service lead').lean(),
    ServiceDashboard.find({ project: projectId }).select('service technicalDirector').lean(),
  ]);
  const empById = new Map(employees.map((e) => [id(e), e]));
  const userByEmp = new Map(users.filter((u) => u.employee).map((u) => [id(u.employee), u]));
  const alias = new Map();
  const add = (key, e) => { const k = norm(key); if (!k) return; alias.set(k, alias.has(k) && alias.get(k) !== id(e) ? null : id(e)); };
  for (const e of employees) for (const k of [e._id, e.empId, e.email, fullName(e), [e.firstName, e.lastName].filter(Boolean).join(' ')]) add(k, e);
  for (const u of users) if (u.employee && empById.has(id(u.employee))) for (const k of [u.name, u.email]) add(k, u.employee);
  const resolve = (key) => alias.get(norm(key)) ?? null;

  const out = new Map(); // employeeId -> { employee, user, label, service }
  const take = (empId, service) => {
    const e = empById.get(empId);
    if (!e) return;
    const user = userByEmp.get(empId);
    const label = headLabel(e, user?.role);
    if (!label || ['ED', 'Founding Director'].includes(label)) return;
    const cur = out.get(empId);
    if (cur) { if (!cur.services.includes(service)) cur.services.push(service); return; }
    out.set(empId, { employee: e, user, label, services: [service] });
  };

  for (const service of wanted) {
    // Team leads of this project's teams for the service, then their chain upwards.
    const leads = teams.filter((t) => expandServices([t.service]).includes(service)).map((t) => id(t.lead)).filter(Boolean);
    for (const start of leads) {
      take(start, service);
      const seen = new Set([start]);
      let cur = empById.get(start);
      for (let depth = 0; cur && depth < 8; depth += 1) {
        const next = [resolve(cur.reportingManager), resolve(cur.director)].filter((x) => x && !seen.has(x));
        if (!next.length) break;
        for (const n of next) { seen.add(n); take(n, service); }
        cur = empById.get(next[0]);
      }
    }
    // The service's TD recorded on the project's service dashboard.
    const code = expandServiceCodes([service])[0];
    for (const d of dashboards) if (d.service === code && d.technicalDirector) {
      const td = resolve(d.technicalDirector);
      if (td) take(td, service);
    }
  }

  // EDs and Founding Directors: every project, every service.
  for (const u of users) if (['executive_director', 'founding_director'].includes(u.role)) {
    const key = u.employee ? id(u.employee) : `user:${id(u)}`;
    if (out.has(key)) continue;
    out.set(key, { employee: u.employee ? empById.get(id(u.employee)) ?? null : null, user: u, label: ROLE_LABEL[u.role], services: ['All services'] });
  }
  return [...out.values()];
}
