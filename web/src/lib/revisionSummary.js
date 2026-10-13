export const REVISION_STAGES = [
  'Concept',
  'Schematic',
  'Design development',
  'Tender',
  'GFC',
];

const STAGE_ALIASES = new Map([
  ['cd', 'Concept'],
  ['concept', 'Concept'],
  ['sd', 'Schematic'],
  ['schematic', 'Schematic'],
  ['dd', 'Design development'],
  ['design development', 'Design development'],
  ['td', 'Tender'],
  ['tender', 'Tender'],
  ['gfc', 'GFC'],
]);

function normalizedStage(stage) {
  const value = String(stage ?? '').trim();
  return STAGE_ALIASES.get(value.toLowerCase()) ?? value;
}

function revisionService(revision, drawings) {
  if (revision.service) return String(revision.service).trim() || 'Unassigned';
  const drawing = String(revision.drawing ?? '').trim().toLowerCase();
  if (!drawing) return 'Unassigned';
  const services = new Set(
    drawings
      .filter((row) => String(row.drawingNo ?? '').trim().toLowerCase() === drawing)
      .map((row) => String(row.service ?? '').trim())
      .filter(Boolean),
  );
  return services.size === 1 ? [...services][0] : 'Unassigned';
}

function stageWasCompleted(revision, service, stages, project) {
  if (project?.status === 'Completed') return true;

  const stage = normalizedStage(revision.stage);
  const serviceStage = stages.find((row) =>
    normalizedStage(row.stage) === stage
    && service
    && String(row.service ?? '').trim().toLowerCase() === service.toLowerCase(),
  );
  if (serviceStage) {
    return String(serviceStage.currentStatus ?? '').toLowerCase() === 'completed';
  }

  const stageIndex = REVISION_STAGES.indexOf(stage);
  const currentStage = normalizedStage(project?.currentStage);
  const currentIndex = REVISION_STAGES.indexOf(currentStage);
  return stageIndex >= 0 && currentIndex >= 0 && stageIndex < currentIndex;
}

export function summarizeRevisions(revisions, drawings, stages, project) {
  const stageRows = REVISION_STAGES.map((stage) => ({
    stage,
    within: 0,
    after: 0,
    total: 0,
  }));
  const byStage = new Map(stageRows.map((row) => [row.stage, row]));
  const byService = new Map();
  let within = 0;
  let after = 0;

  for (const revision of revisions) {
    const service = revisionService(revision, drawings);
    const stage = normalizedStage(revision.stage);
    const isAfter = stageWasCompleted(revision, service, stages, project);
    if (isAfter) after += 1;
    else within += 1;

    const stageRow = byStage.get(stage);
    if (stageRow) {
      stageRow.total += 1;
      if (isAfter) stageRow.after += 1;
      else stageRow.within += 1;
    }

    let serviceRow = byService.get(service);
    if (!serviceRow) {
      serviceRow = { service, stages: new Map(), within: 0, after: 0, total: 0 };
      byService.set(service, serviceRow);
    }
    serviceRow.stages.set(stage, true);
    serviceRow.total += 1;
    if (isAfter) serviceRow.after += 1;
    else serviceRow.within += 1;
  }

  const stageOrder = new Map(REVISION_STAGES.map((stage, index) => [stage, index]));
  return {
    total: revisions.length,
    within,
    after,
    stageRows,
    serviceRows: [...byService.values()]
      .map((row) => ({
        ...row,
        stages: [...row.stages.keys()].sort(
          (a, b) => (stageOrder.get(a) ?? Number.MAX_SAFE_INTEGER)
            - (stageOrder.get(b) ?? Number.MAX_SAFE_INTEGER),
        ).join(', '),
      }))
      .sort((a, b) => a.service.localeCompare(b.service)),
  };
}
