export const PROJECT_SERVICES = ['STR', 'PHE', 'ELE', 'HVAC', 'FIRE', 'SMEP', 'SMEPF', 'MEP', 'BIM', 'GBS', 'Peer Review'];
const ALIASES = { str: 'Structural', structure: 'Structural', structural: 'Structural', phe: 'Plumbing', plumbing: 'Plumbing', ele: 'Electrical', elec: 'Electrical', electrical: 'Electrical', hvac: 'Mechanical', mechanical: 'Mechanical', fire: 'Fire', 'f&ls': 'Fire', 'fire & life safety': 'Fire', bim: 'BIM', 'bim modeller': 'BIM', gbs: 'GBS', 'peer review': 'Peer Review', 'mep coordination': 'MEP Coordination' };
const BUNDLES = { smep: ['Structural', 'Mechanical', 'Electrical', 'Plumbing'], smepf: ['Structural', 'Mechanical', 'Electrical', 'Plumbing', 'Fire'], mep: ['Mechanical', 'Electrical', 'Plumbing'] };
// Individual service codes shown on drawings (a bundle such as SMEPF is never stored).
const CODE_BY_NAME = { Structural: 'STR', Mechanical: 'HVAC', Electrical: 'ELE', Plumbing: 'PHE', Fire: 'FIRE' };
export function expandServiceCodes(values = []) {
  return expandServices(values).map((name) => CODE_BY_NAME[name] ?? name);
}
// Approved principal allocations persist composite Team.service labels using '+'.
// Expand them for comparisons without renaming any stored team or stage identity.
export function expandServices(values = []) {
  return [...new Set(values.flatMap(v => String(v ?? '').split(/\s*\+\s*/).flatMap(part => {
    const key = part.trim().toLowerCase();
    return BUNDLES[key] ?? [ALIASES[key] ?? part.trim()];
  })).filter(Boolean))];
}
