const idOf = value => String(value?._id ?? value?.id ?? value ?? '');

export function projectMembers(teams, project, includeLeads = false) {
  const rows = teams.filter(team => team.active !== false && (team.projects ?? []).some(p => idOf(p) === idOf(project)))
    .flatMap(team => [
      ...(team.members ?? []).map(member => ({ ...member, service: team.service })),
      ...(includeLeads && team.lead ? [{ employee: team.lead, service: team.service }] : []),
    ]);
  // A valid active team remains an assignment even when a separate nomination
  // record has only the TL. Do not hide that team's employees behind an empty roster.
  return [...new Map(rows.filter(row => idOf(row.employee)).map(row => [
    idOf(row.employee) + (includeLeads ? ':' + row.service : ''), row,
  ])).values()];
}

// Project allocations store every ticked team member in principalTeamLeads;
// only the row the SPOC marked as the team lead carries a lead role. Show just
// the leads: rows with a lead role, plus role-less legacy rows (Admin-era
// principal lead picks) in services where no row is marked as the lead.
const isLeadRow = row => /lead/i.test(String(row?.role ?? ''));
export function principalLeadRows(rows = []) {
  const list = (rows ?? []).filter(Boolean);
  const ledServices = new Set(list.filter(isLeadRow).map(row => String(row.service ?? '')));
  return list.filter(row => isLeadRow(row) || (!String(row.role ?? '').trim() && !ledServices.has(String(row.service ?? ''))));
}
export function principalLeadNames(rows = []) {
  return [...new Set(principalLeadRows(rows)
    .flatMap(row => [row.name, ...(row.names ?? [])])
    .map(name => String(name ?? '').trim())
    .filter(Boolean))];
}
