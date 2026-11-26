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

// Electrical, PHE, Fire and HVAC deliverables from the process manual
// (PSR 24.08.26): stages 1-6 map to Preliminary concept ... GFC.
const ELE_DELIVERABLES = {
  'Preliminary concept': [
    'Conceptual location of DG & electrical room at basement / ground floor',
    'Suggesting earth resistivity tests',
    'Floor level electrical room requirements',
    'Cutout size for electrical shaft & DG shaft',
    'Fresh air option & hot air exhaust for DG',
    'Transformer and RMU location',
    'Services room area requirement',
  ],
  Concept: [
    'Comments and freezing of spatial requirements',
    'Concept plans incorporating finalized spatial plans',
    'Preliminary design intent / conceptual design basis report',
    'Load calculations considering all design factors as approved',
    'Preparation & submission of BESCOM sanction drawing',
    'Budgetary estimate',
  ],
  Schematic: [
    'Finalization of complete electrical system designs',
    'Closure on sanction drawings',
    'Receipt of final architectural drawings for tender working',
    "Finalization of DBR's along with cost estimates",
    'Submission of SLD and schematics',
  ],
  'Design development': [
    'Finalization of arch drawings after incorporation of all services',
    'Submittals of electrical final drawings for conclusion',
    'Co-ordinated layouts for basement, ground, typical, terrace and external',
  ],
  Tender: [
    'Closure of design concepts',
    'Submission of tender drawings and BOQ',
    'Co-ordinated service drawings',
  ],
  GFC: [
    'Site plan - external lighting layout',
    'Site plan - RMU, transformer & DG yard layout',
    'Earthing schematic distribution diagram',
    'Power single line diagram',
    'Site plan - equipment layout',
    'Basement floor - equipment layout',
    'Site plan lightning arrester layout',
    'Level-1 raceway layout',
    'Level-2 raceway layout',
    'Level-3 raceway layout',
    'Level-4 raceway layout',
    'Level-1 power layout',
    'Level-2 power layout',
    'Level-3 power layout',
    'Level-4 power layout',
    'Basement floor lighting, power & cable tray layout',
    'Level-1 lighting, power & cable tray layout',
    'Level-2 lighting, power & cable tray layout',
    'Level-3 lighting, power & cable tray layout',
    'Level-4 lighting, power & cable tray layout',
    'Terrace floor lighting layout',
  ],
};

const PHE_DELIVERABLES = {
  'Preliminary concept': [
    'Comment on number of toilets, wash basins, urinals at each floor as per NBC / client BBS',
    'Techno-commercial analysis of optional systems (stack, flush, STP, piping materials)',
    'Confirmation on PHE shaft size and access',
    'Spatial requirements for STP, sumps, OHT and locations',
    'Specifications for hydrological report and vendor list',
    'MOEF consultants - project requirement & liaisoning consultants',
  ],
  Concept: [
    'Comments and freezing of spatial requirements',
    'Concept plans incorporating finalized spatial plans',
    'Preliminary design intent / conceptual design basis report',
    'Water balance chart as per NBC & client BBS',
    'UG sumps (raw, treated, fire) capacities and OHT location finalization',
    'MOEF - start of process',
    'Budgetary estimate',
  ],
  Schematic: [
    'Finalization of complete PHE system designs',
    'Closure on rain water pipe locations, storm water and subsoil drainage',
    'Basement SW sump and drainage system',
    'Closure on sanction drawings',
    'Receipt of final architectural drawings for tender working',
    "Finalization of DBR's along with cost estimates",
    'Submission of SLD and schematics',
  ],
  'Design development': [
    'Finalization of arch drawings after incorporation of all services',
    'Submittals of PHE final drawings for conclusion',
    'Co-ordinated layouts for basement, ground, typical, terrace and external',
  ],
  Tender: [
    'Closure of design concepts',
    'Submission of tender drawings and BOQ',
    'Co-ordinated service drawings',
  ],
  GFC: [
    'Basement floor surface drainage layout',
    'Basement ceiling level plumbing services layout',
    'Site plan plumbing layout',
    'Level-1 plumbing layout',
    'Level-2 plumbing layout',
    'Level-3 plumbing layout',
    'Level-4 plumbing layout',
    'Terrace floor plumbing layout',
    'Water supply schematic diagram',
    'Enlarged water supply & drainage details',
    'UG sump & pump room layout',
    'Sewage treatment plant layout',
    'Typical construction details',
  ],
};

const FIRE_DELIVERABLES = {
  'Preliminary concept': [
    'NBC & local by-laws comparison & feedback on architectural drawings',
    'Recent changes to NBC / local by-laws and impact on floor plans',
    'No. of staircases and travel distances',
    'FHR numbers and locations',
    'Spatial requirement for fire services (tanks, pump room etc.)',
    'No. of shafts & staircases to terrace',
  ],
  Concept: [
    'Comments and freezing of spatial requirements',
    'Preliminary design intent / conceptual design basis report',
    'Statutory norms to be captured in architectural plans',
    'Fire tank capacities (UGS and OHT)',
    'Fire sanction drawings preparation - architectural checklist',
    'Budgetary estimate',
  ],
  Schematic: [
    'Finalization of complete FPS system designs',
    'Fire NOC sanction drawings submission',
    'Receipt of final architectural drawings for tender working',
    "Finalization of DBR's along with cost estimates",
    'Submission of SLD and schematics',
  ],
  'Design development': [
    'Finalization of arch drawings after incorporation of all services',
    'Submittals of FPS final drawings for conclusion',
    'Co-ordinated layouts for basement, ground, typical, terrace and external',
  ],
  Tender: [
    'Closure of design concepts',
    'Submission of tender drawings and BOQ',
    'Co-ordinated service drawings',
  ],
  GFC: [
    'Schematic diagram for fire protection system',
    'Fire protection system for basement',
    'Fire protection system for level 1',
    'Fire protection system for level 2',
    'Fire protection system for level 3',
    'Fire protection system for level 4',
    'Fire protection system for terrace',
  ],
};

const HVAC_DELIVERABLES = {
  'Preliminary concept': [
    'Techno-commercial analysis of optional systems (chiller / VRF / high wall units)',
    'Staircase and lift pressurisation study',
    'Shafts and location of fan room',
    'Multi user shaft location',
    'Location of AHUs and number per floor',
    'Basement zoning & ventilation requirements',
    'Chiller / VRF / ODU locations',
  ],
  Concept: [
    'Comments and freezing of spatial requirements',
    'Concept plans incorporating finalized spatial plans',
    'Preliminary design intent / conceptual design basis report',
    'Mechanical ventilation requirement for basement',
    'Chiller and other equipment layouts and spatial requirements',
    'AHU size and cutout size',
    'Budgetary estimate',
  ],
  Schematic: [
    'Finalization of complete HVAC system designs',
    'Closure on sanction drawings',
    'Routing layout with section for height understanding',
    'Receipt of final architectural drawings for tender working',
    "Finalization of DBR's along with cost estimates",
    'Submission of SLD and schematics',
  ],
  'Design development': [
    'Finalization of arch drawings after incorporation of all services',
    'Submittals of HVAC final drawings for conclusion',
    'Co-ordinated layouts for basement, ground, typical, terrace and external',
  ],
  Tender: [
    'Closure of design concepts',
    'Submission of tender drawings and BOQ',
    'Co-ordinated service drawings',
  ],
  GFC: [
    'Legend - HVAC',
    'Standard duct construction & fixing details',
    'Standard piping works & fixing details',
    'Schematic chilled & condenser water piping diagram',
    'Blown up layout for HVAC plant room',
    'Smoke extract, lift lobby pressurization, toilet & kitchen exhaust schematic',
    'Ventilation layout for STP',
    ...[0, 1, 2, 3, 4].flatMap((l) => ['A', 'B', 'C'].map((w) => `Level ${l} - HVAC service layout for wing ${w}`)),
    ...['A', 'B', 'C'].map((w) => `Level 5 - HVAC equipment location layout for wing ${w}`),
  ],
};

// Standard deliverables per service code, then per stage. A service without a
// list offers only "Other (specify)" — another service's items are never shown.
export const SERVICE_STAGE_DELIVERABLES = {
  STR: STAGE_DELIVERABLES,
  ELE: ELE_DELIVERABLES,
  PHE: PHE_DELIVERABLES,
  FIRE: FIRE_DELIVERABLES,
  HVAC: HVAC_DELIVERABLES,
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
