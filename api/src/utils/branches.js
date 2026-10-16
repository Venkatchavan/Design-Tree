import { Branch } from '../models/Branch.js';

export function normalizeBranchName(value) {
  return String(value ?? '').trim();
}

// Active master names, sorted. Empty when no branches were added yet.
export async function activeBranchNames() {
  const rows = await Branch.find({ isActive: true }, { name: 1 })
    .sort({ name: 1 })
    .lean();
  return rows.map((r) => r.name);
}

// Strict-membership check for form writes. Returns the canonical master
// casing. Throws a 400 error when the value is not an active branch.
export async function requireActiveBranch(value) {
  const name = normalizeBranchName(value);
  if (!name) return '';
  const hit = await Branch.findOne({
    key: name.toLowerCase(),
    isActive: true,
  }).lean();
  if (!hit) {
    const valid = await activeBranchNames();
    const err = new Error(
      valid.length > 0
        ? `Unknown branch "${name}". Valid branches: ${valid.join(', ')}.`
        : `Unknown branch "${name}". No branches exist yet — ask Admin to add one.`,
    );
    err.status = 400;
    throw err;
  }
  return hit.name;
}

// Union of the active master and legacy free-text values still stored on
// records, so filters keep working while the master starts empty.
export async function branchOptionsWithLegacy(distinctValues) {
  const active = await activeBranchNames();
  const legacy = (distinctValues ?? []).filter(Boolean).map((v) => String(v));
  return [...new Set([...active, ...legacy])].sort((a, b) =>
    a.localeCompare(b),
  );
}
