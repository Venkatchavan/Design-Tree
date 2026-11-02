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
