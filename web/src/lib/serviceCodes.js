// Mirrors api/src/config/services.js: split a team's composite service label
// (e.g. "SMEPF" or "STR + ELE") into individual service codes.
const ALIASES = {
  str: 'STR', structure: 'STR', structural: 'STR',
  phe: 'PHE', plumbing: 'PHE',
  ele: 'ELE', elec: 'ELE', electrical: 'ELE',
  hvac: 'HVAC', mechanical: 'HVAC',
  fire: 'FIRE', 'f&ls': 'FIRE', 'fire & life safety': 'FIRE',
};
const BUNDLES = {
  smepf: ['STR', 'HVAC', 'ELE', 'PHE', 'FIRE'],
  smep: ['STR', 'HVAC', 'ELE', 'PHE'],
  mep: ['HVAC', 'ELE', 'PHE'],
  mepf: ['HVAC', 'ELE', 'PHE', 'FIRE'],
};

// Design services that each keep their own stage-wise deliverables and trackers.
export const DESIGN_SERVICE_CODES = ['STR', 'HVAC', 'ELE', 'PHE', 'FIRE'];
export const SERVICE_CODE_LABELS = { STR: 'Structural (S)', HVAC: 'Mechanical (M)', ELE: 'Electrical (E)', PHE: 'Plumbing (P)', FIRE: 'Fire (F)' };

export function expandServiceCodes(values = []) {
  return [...new Set(values.flatMap((v) => String(v ?? '').split(/\s*\+\s*/).flatMap((part) => {
    const key = part.trim().toLowerCase();
    return BUNDLES[key] ?? [ALIASES[key] ?? part.trim()];
  })).filter(Boolean))];
}
