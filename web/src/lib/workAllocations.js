// Project summaries split the source's saved additional-project components;
// canonical entry lists keep one row identified by source:id.
export function workAllocations(entry) {
  if (Array.isArray(entry.reportAllocations)) return entry.reportAllocations.map(allocation => ({
    ...entry, ...allocation, sourceKey: entry.key, reportAllocations: undefined,
    otherHours: [], primaryHours: allocation.hours,
  }));
  if (entry.source !== 'WorkEntry') return [entry];
  return [
    { ...entry, hours: entry.primaryHours ?? entry.hours },
    ...(entry.otherHours ?? []).map((row, index) => ({
      ...entry,
      key: `${entry.key}:other:${index}`,
      project: row.project,
      stage: null,
      hours: row.hours ?? 0,
    })),
  ];
}
