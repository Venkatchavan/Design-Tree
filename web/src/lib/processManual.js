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
  const exact = PROCESS_STAGES.find((p) => p.toLowerCase() === s.toLowerCase());
  if (exact) return exact;
  return LEGACY_STAGE[s.toUpperCase()] ?? s;
}

// Standard deliverables per service code, then per stage. Only the Structural
// set has been supplied so far; add HVAC / ELE / PHE / FIRE lists here from the
// process manual. Until a service has its own list, its dropdown offers only
// "Other (specify)" — another service's items are never shown.
export const SERVICE_STAGE_DELIVERABLES = {
  STR: STAGE_DELIVERABLES,
};

const SERVICE_ALIASES = {
  str: 'STR', structure: 'STR', structural: 'STR', structures: 'STR',
  hvac: 'HVAC', mechanical: 'HVAC', ele: 'ELE', elec: 'ELE', electrical: 'ELE',
  phe: 'PHE', plumbing: 'PHE', fire: 'FIRE', 'f&ls': 'FIRE', 'fire & life safety': 'FIRE',
};
const serviceCode = (s) => SERVICE_ALIASES[String(s ?? '').trim().toLowerCase()] ?? String(s ?? '').trim().toUpperCase();

// `service` may be one code / label, or a list of them (e.g. the services of the
// people a task is assigned to). With no service given, the Structural set is
// used (legacy callers). Several services share only items common to all.
export function stageDeliverables(stage, service = '') {
  const codes = [...new Set((Array.isArray(service) ? service : [service]).filter(Boolean).map(serviceCode))];
  const listFor = (code) => SERVICE_STAGE_DELIVERABLES[code]?.[manualStage(stage)] ?? [];
  if (codes.length === 0) return listFor('STR');
  return codes.map(listFor).reduce((common, list) => common.filter((d) => list.includes(d)));
}
