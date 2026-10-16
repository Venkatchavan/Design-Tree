export const PROJECT_SERVICES = ['STR', 'PHE', 'ELE', 'HVAC', 'FIRE', 'SMEP', 'SMEPF', 'MEP', 'BIM', 'GBS', 'Peer Review'];
const ALIASES = { str: 'Structural', structure: 'Structural', structural: 'Structural', phe: 'Plumbing', plumbing: 'Plumbing', ele: 'Electrical', elec: 'Electrical', electrical: 'Electrical', hvac: 'Mechanical', mechanical: 'Mechanical', fire: 'Fire', bim: 'BIM', gbs: 'GBS', 'peer review': 'Peer Review', 'mep coordination': 'MEP Coordination' };
const BUNDLES = { smep: ['Structural', 'Mechanical', 'Electrical', 'Plumbing'], smepf: ['Structural', 'Mechanical', 'Electrical', 'Plumbing', 'Fire'], mep: ['Mechanical', 'Electrical', 'Plumbing'] };
export function expandServices(values = []) {
  return [...new Set(values.flatMap(v => {
    const key = String(v ?? '').trim().toLowerCase();
    return BUNDLES[key] ?? [ALIASES[key] ?? String(v ?? '').trim()];
  }).filter(Boolean))];
}
