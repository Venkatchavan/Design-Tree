export const normalizedEmail = value => String(value ?? '').normalize('NFKC').trim().toLowerCase();
const normalizedName = value => String(value ?? '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const id = value => String(value?._id ?? value ?? '');
const employeeName = e => [e.firstName, e.middleName, e.lastName].filter(Boolean).join(' ');
const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export function auditRoster(roster, users, employees) {
  const entries = roster.map(row => ({ ...row, name: String(row.name ?? '').trim(), email: normalizedEmail(row.email) }));
  const seen = new Set();
  const rows = entries.map(row => {
    const name = normalizedName(row.name);
    const loginMatches = users.filter(u => row.email && normalizedEmail(u.email) === row.email);
    const employeeMatches = employees.filter(e => row.email && normalizedEmail(e.email) === row.email);
    const namedUsers = users.filter(u => name && normalizedName(u.name) === name);
    const namedEmployees = employees.filter(e => name && normalizedName(employeeName(e)) === name);
    const result = { ...row, userIds: loginMatches.map(id), employeeIds: employeeMatches.map(id) };
    const finish = (status, reason) => ({ ...result, status, reason });
    if (row.emailCandidates?.length > 1) {
      return { ...finish('review', 'This workbook row contains multiple emails. Confirm the correct login before creation.'),
        userIds: users.filter(u => row.emailCandidates.includes(normalizedEmail(u.email))).map(id),
        employeeIds: employees.filter(e => row.emailCandidates.includes(normalizedEmail(e.email))).map(id) };
    }
    if (!row.email) return finish('pending_email', 'Email unavailable; retain for a later update. No login will be created.');
    if (!validEmail(row.email) || !name) return finish('review', 'A valid name and email are required; no placeholder identity is created.');
    if (entries.some(other => other !== row && normalizedName(other.name) === name && other.email && other.email !== row.email)) {
      return finish('review', 'The roster contains this name with different emails. Confirm identity before creating a login.');
    }
    if (entries.some(other => other !== row && other.email === row.email && normalizedName(other.name) !== name)) {
      return finish('review', 'The roster shares an email across different names. Confirm identity before creating a login.');
    }
    if (seen.has(row.email)) return finish('duplicate_roster', 'Repeated roster email; the first occurrence is already accounted for.');
    seen.add(row.email);
    if (loginMatches.length > 1 || employeeMatches.length > 1) return finish('review', 'Multiple database records match this normalized email; no record will be created or merged.');
    const user = loginMatches[0], employee = employeeMatches[0];
    if (user) {
      const linkedEmployee = employees.find(e => id(e) === id(user.employee));
      if ((user.employee && !linkedEmployee) || (employee && user.employee && id(user.employee) !== id(employee)) ||
          (employee?.user && id(employee.user) !== id(user)) || (linkedEmployee?.user && id(linkedEmployee.user) !== id(user))) {
        return finish('review', 'Existing login/employee links need reconciliation; no duplicate or automatic link repair.');
      }
      return finish('existing_login', user.isActive === false ? 'Login exists but is inactive; preserved without activation or password/role changes.' : 'Login already exists; preserve its role, password and employee link.');
    }
    if (employee) return finish('employee_only', 'Employee already exists. Review or provision its login against that same record; do not create another employee.');
    if (namedUsers.length || namedEmployees.length) {
      return { ...finish('review', 'An existing record matches the name with a different or missing email. Confirm identity before creation.'), nameMatchedUserIds: namedUsers.map(id), nameMatchedEmployeeIds: namedEmployees.map(id) };
    }
    return finish('missing_login', 'No matching email or normalized name in the supplied database snapshot.');
  });
  const counts = Object.fromEntries(['existing_login', 'employee_only', 'pending_email', 'duplicate_roster', 'review', 'missing_login'].map(status => [status, rows.filter(row => row.status === status).length]));
  const duplicateEmails = records => {
    const counts = new Map();
    for (const record of records) { const email = normalizedEmail(record.email); if (email) counts.set(email, (counts.get(email) ?? 0) + 1); }
    return [...counts].filter(([, count]) => count > 1).map(([email, count]) => ({ email, count }));
  };
  return { generatedAt: new Date().toISOString(), readOnly: true, rosterRows: rows.length, databaseUsers: users.length, databaseEmployees: employees.length, counts,
    duplicateDatabaseEmails: { users: duplicateEmails(users), employees: duplicateEmails(employees) }, rows };
}

export function rosterFromWorkbook(workbook, XLSX) {
  return workbook.SheetNames.flatMap(sheet => XLSX.utils.sheet_to_json(workbook.Sheets[sheet], { header: 1, defval: '', blankrows: true, range: 0 })
    .flatMap((cells, index) => {
      if (!cells.some(cell => String(cell ?? '').trim())) return [];
      const emailCandidates = [...new Set(cells.filter(cell => validEmail(String(cell ?? '').trim())).map(normalizedEmail))];
      return [{ sheet, row: index + 1, name: String(cells[0] ?? '').trim(), email: emailCandidates[0] ?? '', emailCandidates }];
    }));
}
