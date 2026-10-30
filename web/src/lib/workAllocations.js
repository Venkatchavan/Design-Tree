// Project summaries split the source's saved additional-project components;
// canonical entry lists keep one row identified by source:id.
export function workAllocations(entry) {
  if (entry.source !== 'WorkEntry') return [entry];
  return [
    { ...entry, hours: entry.primaryHours ?? entry.hours },
    ...(entry.otherHours ?? []).map((row, index) => ({
      ...entry,
      key: `${entry.key}:other:${index}`,
      project: row.project,
      hours: row.hours ?? 0,
    })),
  ];
}
