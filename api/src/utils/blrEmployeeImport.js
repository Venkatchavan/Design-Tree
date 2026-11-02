// Bengaluru roster import (final list + team workbooks). Skip-if-exists:
// existing employees, logins, roles and filled fields are never duplicated or
// overwritten; only empty fields and missing links are added.
const id = (value) => String(value?._id ?? value ?? '');
export const normalizedEmail = (value) => String(value ?? '').normalize('NFKC').trim().toLowerCase();
export const normalizedName = (value) => String(value ?? '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const fullName = (e) => [e.firstName, e.middleName, e.lastName].filter(Boolean).join(' ');
const blank = (value) => value === undefined || value === null || String(value).trim() === '';
const AUTO_EMP_ID = /^EMP-\d+$/i;
const BRANCH_PATTERN = /beng|bangal|blr/i;

// Fields filled only while empty on the existing record (list value -> field).
const FILL_FIELDS = [
  ['designation', 'designation'],
  ['department', 'department'],
  ['branch', 'branch'],
  ['reportsTo', 'reportingManager'],
  ['seesTeamOf', 'teamViewOf'],
];

export function inferRole(row) {
  const d = String(row.designation ?? '');
  if (/associate\s+technical\s+director/i.test(d)) return 'assoc_technical_director';
  if (/technical\s+director/i.test(d)) return 'technical_director';
  if (/associate\s+director/i.test(d)) return 'associate_director';
  if (/executive\s+director/i.test(d)) return 'executive_director';
  if (/\blead\b/i.test(d)) return 'team_lead';
  if (row.department === 'QS') return 'qs';
  if (row.department === 'QA/QC') return 'qaqc';
  if (row.department === 'BIM Modeller') return 'bim';
  return 'engineer_drafter';
}

// Merge emails from an updated copy of the main list (EMP ID -> email) and
// re-check that no address is given to two people.
export function mergeEmails(roster, updates = new Map()) {
  const merged = roster.map((row) => {
    const fresh = row.empId ? normalizedEmail(updates.get(row.empId)) : '';
    return { ...row, email: fresh || normalizedEmail(row.email) || normalizedEmail(row.sharedEmail) || null, sharedEmail: undefined };
  });
  const counts = new Map();
  for (const row of merged) if (row.email) counts.set(row.email, (counts.get(row.email) ?? 0) + 1);
  return merged.map((row) => (row.email && counts.get(row.email) > 1 ? { ...row, sharedEmail: row.email, email: null } : row));
}

export function pickBranch({ branches, employees, override }) {
  const active = branches.filter((b) => b.isActive !== false).map((b) => b.name);
  const legacy = [...new Set(employees.map((e) => e.branch).filter(Boolean))];
  if (override) {
    const hit = [...active, ...legacy].find((name) => name.trim().toLowerCase() === override.trim().toLowerCase());
    return hit ? { branch: hit, source: active.includes(hit) ? 'branch master' : 'existing employee records' } : { error: `Branch "${override}" does not exist.`, active, legacy };
  }
  const masters = active.filter((name) => BRANCH_PATTERN.test(name));
  if (masters.length === 1) return { branch: masters[0], source: 'branch master' };
  if (masters.length > 1) return { error: 'Several Bengaluru branches exist; choose one with --branch.', active, legacy };
  const used = legacy.filter((name) => BRANCH_PATTERN.test(name));
  if (used.length === 1) return { branch: used[0], source: 'existing employee records' };
  return { error: used.length ? 'Several Bengaluru branch values exist; choose one with --branch.' : 'No Bengaluru branch exists. Ask Admin to add it, then re-run (or pass --branch).', active, legacy };
}

// Pure plan over a database snapshot. Nothing is written here.
export const exactName = (value) => String(value ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
// Normalized names that appear more than once in the list ("Karthik.S" / "Karthik S")
// are only matched by their exact spelling.
export function rosterNameCounts(roster) {
  const counts = new Map();
  for (const row of roster) { const key = normalizedName(row.name); counts.set(key, (counts.get(key) ?? 0) + 1); }
  return counts;
}

export function planImport({ roster, employees, users, branch, roleByEmail = new Map() }) {
  const byEmpId = new Map(), byEmail = new Map(), byName = new Map(), byExactName = new Map();
  const push = (map, key, e) => { if (!key) return; if (!map.has(key)) map.set(key, []); map.get(key).push(e); };
  for (const e of employees) {
    push(byEmpId, String(e.empId ?? '').toUpperCase(), e);
    push(byEmail, normalizedEmail(e.email), e);
    push(byName, normalizedName(fullName(e)), e);
    push(byExactName, exactName(fullName(e)), e);
  }
  const usersByEmail = new Map(), usersById = new Map(users.map((u) => [id(u), u]));
  for (const u of users) push(usersByEmail, normalizedEmail(u.email), u);
  const employeesById = new Map(employees.map((e) => [id(e), e]));
  const nameCounts = rosterNameCounts(roster);
  const claimed = new Map();
  const rows = [];

  for (const row of roster) {
    const empId = String(row.empId ?? '').toUpperCase();
    const email = normalizedEmail(row.email);
    const out = { empId: row.empId ?? null, name: row.name, department: row.department, set: {}, kept: [], notes: [] };
    const conflict = (reason) => rows.push({ ...out, action: 'conflict', reason });

    // 1. Find the existing employee: EMP ID, then email, then a unique name.
    let match = null, how = '';
    const idHits = empId ? byEmpId.get(empId) ?? [] : [];
    if (idHits.length > 1) { conflict(`Several employees already have EMP ID ${empId}.`); continue; }
    if (idHits.length === 1) { match = idHits[0]; how = 'empId'; }
    if (!match && email) {
      const hits = byEmail.get(email) ?? [];
      if (hits.length > 1) { conflict(`Several employees already use ${email}.`); continue; }
      if (hits.length === 1) {
        const existing = String(hits[0].empId ?? '');
        if (existing && !AUTO_EMP_ID.test(existing) && existing.toUpperCase() !== empId) { conflict(`${email} belongs to employee ${existing}, not ${row.empId ?? 'this person'}.`); continue; }
        match = hits[0]; how = 'email';
      }
    }
    // An existing login with this email points at the person's employee record.
    if (!match && email) {
      const logins = usersByEmail.get(email) ?? [];
      const linked = logins.length === 1 && logins[0].employee ? employeesById.get(id(logins[0].employee)) : null;
      if (linked) {
        const existing = String(linked.empId ?? '');
        if (existing && !AUTO_EMP_ID.test(existing) && existing.toUpperCase() !== empId) { conflict(`Login ${email} belongs to employee ${existing}, not ${row.empId ?? 'this person'}.`); continue; }
        match = linked; how = 'login';
      }
    }
    const uniqueName = (nameCounts.get(normalizedName(row.name)) ?? 0) <= 1;
    const sameName = uniqueName ? (byName.get(normalizedName(row.name)) ?? []) : (byExactName.get(exactName(row.name)) ?? []);
    if (!match) {
      const hits = sameName.filter((e) => {
        const existing = String(e.empId ?? '');
        const idOk = !existing || AUTO_EMP_ID.test(existing) || existing.toUpperCase() === empId;
        const mailOk = !e.email || normalizedEmail(e.email) === email;
        return idOk && mailOk;
      });
      if (hits.length > 1) { conflict(`Several existing employees are named "${row.name}"; not merged.`); continue; }
      if (hits.length === 1) { match = hits[0]; how = 'name'; }
    }
    // Duplicate guard: never create a second record for a name that already exists.
    if (!match) {
      const same = byName.get(normalizedName(row.name)) ?? [];
      if (same.length) {
        conflict(`An employee named "${row.name}" already exists (${same.map((e) => [e.empId, e.email].filter(Boolean).join(', ') || id(e)).join('; ')}); not created. Confirm whether it is the same person.`);
        continue;
      }
    }
    if (match) {
      if (claimed.has(id(match))) { conflict(`Matches the same existing employee as ${claimed.get(id(match))}; not merged.`); continue; }
      claimed.set(id(match), row.name);
    }

    // 2. Fields to fill (existing values always win).
    const wanted = { ...row, branch };
    if (match) {
      if (empId) {
        const existing = String(match.empId ?? '');
        if (!existing || AUTO_EMP_ID.test(existing)) {
          if ((byEmpId.get(empId) ?? []).some((e) => id(e) !== id(match))) { conflict(`EMP ID ${empId} is already used by another employee.`); continue; }
          out.set.empId = empId;
        } else if (existing.toUpperCase() !== empId) out.kept.push({ field: 'empId', existing, list: empId });
      }
      for (const [from, field] of FILL_FIELDS) {
        const value = wanted[from];
        if (blank(value)) continue;
        const previous = row.was?.[from];
        if (blank(match[field])) out.set[field] = value;
        // Updated client hierarchy: replace only a value this import wrote earlier and nobody changed since.
        else if (previous && String(match[field]).trim() === previous && previous !== value) { out.set[field] = value; (out.replace ??= {})[field] = previous; }
        else if (String(match[field]).trim() !== String(value).trim()) out.kept.push({ field, existing: match[field], list: value });
      }
      if (email) {
        if (blank(match.email)) {
          if ((byEmail.get(email) ?? []).some((e) => id(e) !== id(match))) out.notes.push(`${email} is used by another employee; email not added.`);
          else out.set.email = email;
        } else if (normalizedEmail(match.email) !== email) out.kept.push({ field: 'email', existing: match.email, list: email });
      }
    }

    // 3. Login: reuse by email, create only when none exists.
    let login = { action: 'none' };
    const employeeUser = match?.user ? usersById.get(id(match.user)) : null;
    if (!email) {
      login = { action: 'none', reason: row.sharedEmail ? `Email ${row.sharedEmail} is shared with another person in the list.` : 'Email not provided yet.' };
    } else {
      const hits = usersByEmail.get(email) ?? [];
      if (hits.length > 1) login = { action: 'conflict', reason: `Several logins use ${email}.` };
      else if (hits.length === 1) {
        const user = hits[0];
        const userLinkedElsewhere = user.employee && (!match || id(user.employee) !== id(match));
        const employeeLinkedElsewhere = match?.user && id(match.user) !== id(user);
        if (userLinkedElsewhere) login = { action: 'conflict', reason: `Login ${email} is linked to a different employee.` };
        else if (employeeLinkedElsewhere) login = { action: 'conflict', reason: `Employee already has a different login (${employeeUser?.email ?? id(match.user)}).` };
        else if (!user.employee || !match?.user) login = { action: 'link', userId: id(user) };
        else login = { action: 'exists' };
      } else if (match?.user) {
        login = { action: 'none', reason: `Employee already has a login (${employeeUser?.email ?? id(match.user)}).` };
      } else {
        login = { action: 'create', role: roleByEmail.get(email) ?? inferRole(row) };
      }
    }

    const changed = Object.keys(out.set).length > 0;
    rows.push({
      ...out,
      how,
      employeeId: match ? id(match) : null,
      action: match ? (changed ? 'update' : 'unchanged') : 'create',
      create: match ? null : { empId: empId || null, firstName: row.name, designation: row.designation, department: row.department, branch, email: email && !(byEmail.get(email) ?? []).length ? email : undefined, reportingManager: row.reportsTo, teamViewOf: row.seesTeamOf, status: 'Active' },
      login,
    });
  }
  return rows;
}

export function planHeads({ heads, employees, users }) {
  // Names compared without spaces/punctuation so "Pruthviraj" = "Pruthvi Raj".
  const compact = (value) => normalizedName(value).replace(/ /g, '');
  return heads.map((head) => {
    const keys = new Set([head.name, ...(head.aliases ?? [])].map(compact));
    const employeeHits = employees.filter((e) => keys.has(compact(fullName(e))));
    const userHits = users.filter((u) => keys.has(compact(u.name)));
    if (employeeHits.length > 1 || userHits.length > 1) return { ...head, action: 'conflict', reason: 'Several records share this name; not linked.' };
    const employee = employeeHits[0] ?? (userHits[0]?.employee ? employees.find((e) => id(e) === id(userHits[0].employee)) : null);
    if (employee) {
      const missing = head.departments.filter((d) => !(employee.headOfDepartments ?? []).includes(d));
      return { ...head, employeeId: id(employee), action: missing.length ? 'grant' : 'unchanged', add: missing };
    }
    if (userHits[0]) return { ...head, userId: id(userHits[0]), action: 'create-employee', add: head.departments, email: userHits[0].email };
    return { ...head, action: 'not-found', reason: 'No employee or login with this name exists in the app.' };
  });
}

export function nextAutoEmpId(employees) {
  const max = employees.reduce((n, e) => { const m = AUTO_EMP_ID.test(String(e.empId ?? '')) ? Number(String(e.empId).slice(4)) : 0; return Math.max(n, m); }, 0);
  return `EMP-${String(max + 1).padStart(4, '0')}`;
}

// Writes the plan. Every step re-reads the record and only fills what is still
// empty, so a concurrent edit or a repeated run never overwrites or duplicates.
export async function applyImport({ plan, heads, Employee, User, passwordHash }) {
  const results = [];
  for (const row of plan) {
    if (row.action === 'conflict') { results.push({ name: row.name, empId: row.empId, status: 'conflict', reason: row.reason }); continue; }
    let employee, createdEmployee = null, createdUser = null;
    try {
      let status = row.action;
      if (row.action === 'create') {
        const data = Object.fromEntries(Object.entries(row.create).filter(([, v]) => !blank(v)));
        if (!data.empId) data.empId = nextAutoEmpId(await Employee.find({ empId: /^EMP-\d+$/i }).select('empId').lean());
        if (await Employee.exists({ empId: data.empId })) throw Object.assign(new Error(`EMP ID ${data.empId} already exists.`), { skip: true });
        employee = createdEmployee = await Employee.create(data);
      } else {
        employee = await Employee.findById(row.employeeId);
        if (!employee) throw Object.assign(new Error('Employee disappeared during import.'), { skip: true });
        const set = {};
        for (const [field, value] of Object.entries(row.set)) {
          const current = employee[field];
          const replaceable = row.replace?.[field] !== undefined && String(current ?? '').trim() === row.replace[field];
          if (field === 'empId' ? (blank(current) || AUTO_EMP_ID.test(String(current))) : (blank(current) || replaceable)) set[field] = value;
        }
        if (Object.keys(set).length) { employee.set(set); await employee.save(); } else status = 'unchanged';
      }
      let login = row.login.action;
      if (row.login.action === 'create') {
        const email = normalizedEmail(row.create?.email ?? employee.email);
        if (!email || await User.exists({ email })) login = 'exists';
        else if (employee.user) login = 'none';
        else {
          createdUser = await User.create({ name: row.name, email, passwordHash, role: row.login.role, employee: employee._id });
          employee.user = createdUser._id; await employee.save();
          login = 'created';
        }
      } else if (row.login.action === 'link') {
        const user = await User.findById(row.login.userId);
        if (user && (!user.employee || id(user.employee) === id(employee)) && (!employee.user || id(employee.user) === id(user))) {
          if (!user.employee) { user.employee = employee._id; await user.save(); }
          if (!employee.user) { employee.user = user._id; await employee.save(); }
          login = 'linked';
        } else login = 'conflict';
      }
      results.push({ name: row.name, empId: employee.empId, status, login, loginReason: row.login.reason });
    } catch (error) {
      // Roll back only what this attempt created; never touch pre-existing records.
      if (createdUser) await User.deleteOne({ _id: createdUser._id });
      if (createdEmployee) await Employee.deleteOne({ _id: createdEmployee._id });
      results.push({ name: row.name, empId: row.empId, status: error.skip ? 'conflict' : 'failed', reason: error.code === 11000 ? 'Duplicate EMP ID or email detected; this row was rolled back.' : error.message });
    }
  }
  const headResults = [];
  for (const head of heads) {
    try {
      if (head.action === 'grant') {
        const employee = await Employee.findById(head.employeeId);
        const missing = head.add.filter((d) => !(employee.headOfDepartments ?? []).includes(d));
        if (missing.length) { employee.headOfDepartments = [...(employee.headOfDepartments ?? []), ...missing]; await employee.save(); }
        headResults.push({ name: head.name, status: missing.length ? 'granted' : 'unchanged', departments: head.departments });
      } else if (head.action === 'create-employee') {
        const user = await User.findById(head.userId);
        if (!user || user.employee) { headResults.push({ name: head.name, status: 'unchanged', reason: 'Login already has an employee record; re-run to grant.' }); continue; }
        const employee = await Employee.create({ empId: nextAutoEmpId(await Employee.find({ empId: /^EMP-\d+$/i }).select('empId').lean()), firstName: user.name, email: normalizedEmail(user.email) || undefined, headOfDepartments: head.add, status: 'Active', user: user._id });
        user.employee = employee._id; await user.save();
        headResults.push({ name: head.name, status: 'granted', departments: head.departments, note: 'Employee record created for the existing login.' });
      } else headResults.push({ name: head.name, status: head.action, reason: head.reason });
    } catch (error) { headResults.push({ name: head.name, status: 'failed', reason: error.message }); }
  }
  return { results, headResults };
}
