import Panel from './Panel.jsx';
import DataTable from './DataTable.jsx';
import EmptyState from './EmptyState.jsx';

const idOf = (v) => String(v?._id ?? v?.id ?? v ?? '');
const norm = (v) => String(v ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
const fullName = (e) => [e?.firstName, e?.middleName, e?.lastName].filter(Boolean).join(' ') || e?.empId || 'Not recorded';
const experienceText = (e) => {
  const t = String(e?.experience ?? '').trim();
  return !t ? 'Not recorded' : /^\d+(\.\d+)?$/.test(t) ? `${t} yrs` : t;
};

// The TL / ATD's team as saved from the company employee list (Excel import):
// everyone in their reporting chain, grouped by the person they report to.
export default function ReportingTeamPanel({ query, self = null }) {
  const people = query.data?.employees ?? [];
  if (query.isLoading) return <Panel title="My team (employee list)"><EmptyState text="Loading team…" /></Panel>;
  if (query.isError) return <Panel title="My team (employee list)"><div role="alert">{query.error.message}</div></Panel>;
  const byKey = new Map();
  for (const e of people) for (const k of [e.empId, e.email, fullName(e), [e.firstName, e.lastName].filter(Boolean).join(' ')]) if (k) byKey.set(norm(k), e);
  const selfKeys = new Set([self?.empId, self?.email, fullName(self), [self?.firstName, self?.lastName].filter(Boolean).join(' ')].filter(Boolean).map(norm));
  const groups = new Map();
  for (const e of people) {
    const manager = byKey.get(norm(e.reportingManager));
    const direct = !manager && selfKeys.has(norm(e.reportingManager));
    const key = manager ? idOf(manager) : direct ? '__self' : '__other';
    if (!groups.has(key)) groups.set(key, { key, lead: manager ?? null, rows: [] });
    groups.get(key).rows.push(e);
  }
  const rank = (g) => (g.key === '__self' ? 0 : g.lead ? 1 : 2);
  const ordered = [...groups.values()].sort((a, b) => rank(a) - rank(b) || fullName(a.lead).localeCompare(fullName(b.lead)));
  const columns = [
    { key: 'name', label: 'Team member', render: fullName },
    { key: 'designation', label: 'Designation', render: (e) => e.designation || 'Not recorded' },
    { key: 'department', label: 'Department', render: (e) => e.department || 'Not recorded' },
    { key: 'experience', label: 'Experience', render: experienceText },
    { key: 'branch', label: 'Branch', render: (e) => e.branch || 'Not recorded' },
  ];
  return (
    <Panel title="My team (employee list)" sub={`${people.length} people in your saved reporting team`}>
      {people.length === 0 ? (
        <EmptyState text="No reporting team is saved for you yet. Ask HR to verify the reporting manager links from the employee list." />
      ) : ordered.map((g) => (
        <div key={g.key} style={{ marginBottom: 14 }}>
          <div className="section-label" style={{ marginBottom: 6 }}>
            {g.lead ? `${fullName(g.lead)}'s team${g.lead.designation ? ` · ${g.lead.designation}` : ''}` : g.key === '__self' ? 'Reporting directly to you' : 'Team leads and other saved team links'} ({g.rows.length})
          </div>
          <DataTable columns={columns} rows={g.rows} emptyText="No members." />
        </div>
      ))}
    </Panel>
  );
}
