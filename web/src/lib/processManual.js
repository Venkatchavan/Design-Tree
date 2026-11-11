// Project stages and the standard deliverables of each stage, as laid out in the
// design process manual (taken from the project reference prototype, "List of
// deliverables" / "Assign work"). Edit here to change what every deliverable
// dropdown offers.
export const PROCESS_STAGES = [
  'Preliminary concept',
  'Concept',
  'Schematic',
  'Design development',
  'Tender',
  'GFC',
];

export const STAGE_DELIVERABLES = {
  'Preliminary concept': [
    'Bore hole location and specifications',
    'Techno-commercial analysis of slab systems',
  ],
  Concept: [
    'Preliminary framing plan',
    'Preliminary design basis report',
    'Shoring system proposal',
    'Soil investigation review',
    'Budgetary estimate',
  ],
  Schematic: [
    'Concept plan comments and system finalization',
    'Structural set for sanction submission',
    'Soil report status review',
    'DBR finalization',
    'Tender drawing and BOQ initiation',
    'Final column sizing issuance',
  ],
  'Design development': [
    'Architectural drawing closure',
    'Soil investigation report receipt',
    'Tender drawings and BOQ progress',
    'Column layout and framing plan approval',
    'GFC drawing initiation',
  ],
  Tender: [
    'Design concept closure',
    'Tender drawings and BOQ submission',
    'Coordinated service drawings',
  ],
  GFC: [
    'General notes',
    'Typical RC details',
    'Column layout',
    'Grade slab layout',
    'Basement sections',
    'Retaining wall layout',
    'Column schedule',
    'Corewall CW1 details',
    'Corewall CW2 details',
    'Staircase 1 details',
    'Staircase 2 details',
    'UG sump and storm water details',
    'Level 01 slab shuttering layout',
    'Level 01 beam schedule',
    'Level 02 slab shuttering layout',
    'Level 02 beam schedule',
    'Above terrace details',
    'Boundary wall details',
  ],
};

// Older rows were saved with the short stage codes; show them under the matching
// process-manual stage instead of dropping them.
const LEGACY_STAGE = {
  CD: 'Concept',
  SD: 'Schematic',
  DD: 'Design development',
  TD: 'Tender',
  GFC: 'GFC',
};

export function manualStage(stage) {
  const s = String(stage ?? '').trim();
  if (!s) return '';
  if (PROCESS_STAGES.includes(s)) return s;
  return LEGACY_STAGE[s.toUpperCase()] ?? s;
}

export function stageDeliverables(stage) {
  return STAGE_DELIVERABLES[manualStage(stage)] ?? [];
}
