export default function DataTable({ columns, rows, onRowClick, emptyText }) {
  if (!rows || rows.length === 0) {
    return (
      <p style={{ color: 'var(--ink-muted)', fontSize: 13.5, padding: '8px 0' }}>
        {emptyText ?? 'No records found.'}
      </p>
    );
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row._id ?? row.id ?? i}
              className={onRowClick ? 'row-click' : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((c) => (
                <td key={c.key}>
                  {c.render ? c.render(row) : (row[c.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
