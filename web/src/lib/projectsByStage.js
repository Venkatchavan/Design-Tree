export function projectsByStageChart(allBranches, byBranch, branch) {
  const rows = branch ? byBranch?.[branch] ?? [] : allBranches;
  return {
    labels: rows.map((row) => row.stage ?? '—'),
    datasets: [
      {
        label: 'Projects',
        data: rows.map((row) => row.count ?? 0),
        backgroundColor: '#1D68D6',
      },
    ],
  };
}
