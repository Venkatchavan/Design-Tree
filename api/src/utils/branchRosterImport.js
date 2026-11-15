// Branch employee workbooks (Chennai, Hyderabad, Kolkata, Mumbai, Pune, Vijayawada, ...)
// -> clean roster rows for planImport/applyImport (blrEmployeeImport.js).
// Rows without a usable email are skipped (reported, never guessed).
import * as XLSX from 'xlsx';
import { readFile, readdir } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { normalizedEmail } from './blrEmployeeImport.js';

const EMAIL = /^[a-z0-9._%+'-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const COMPANY_DOMAIN = 'designtreeconsultants.com';
const tidy = (v) => String(v ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
// Stray characters seen in the lists: trailing ' or >, surrounding spaces.
const cleanEmail = (v) => normalizedEmail(v).replace(/^[\s<'"]+|[\s>'";,.]+$/g, '');
// Distance-1 domain typos (desingtreeconsultants.com, designtreeconsultans.com) are
// reported, not corrected: a wrong guess would give a login to a mailbox nobody owns.
const typoDomain = (email) => {
  const domain = email.split('@')[1] ?? '';
  if (domain === COMPANY_DOMAIN || !/tree|desing|design/.test(domain)) return false;
  return domain !== COMPANY_DOMAIN;
};

export async function readBranchWorkbooks(dir) {
  const files = (await readdir(resolve(dir))).filter((n) => /\.xlsx$/i.test(n) && !n.startsWith('~'));
  const rows = [];
  for (const file of files.sort()) {
    const book = XLSX.read(await readFile(resolve(dir, file)), { type: 'buffer', sheetRows: 5000 });
    const sheet = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { header: 1, defval: null });
    const header = (sheet[0] ?? []).map((h) => tidy(h).toLowerCase());
    const col = (prefix) => header.findIndex((h) => h.startsWith(prefix));
    const idx = { empId: col('emp id'), name: col('employee name'), branch: col('branch'), department: col('department'), designation: col('designation'), mail: col('official mail') };
    if (Object.values(idx).some((i) => i < 0)) throw new Error(`${file}: expected columns EMP ID, Employee Name, Branch, Department, Designation, Official mail id.`);
    for (const r of sheet.slice(1)) {
      if (r.every((c) => c === null || tidy(c) === '')) continue;
      rows.push({ file: basename(file), empId: tidy(r[idx.empId]).toUpperCase(), name: tidy(r[idx.name]), branch: tidy(r[idx.branch]), department: tidy(r[idx.department]), designation: tidy(r[idx.designation]), emailRaw: tidy(r[idx.mail]) });
    }
  }
  return rows;
}

// Returns { roster: [{branch, empId, name, designation, department, email}], skipped: [{file, empId, name, reason, value}] }
export function cleanBranchRows(rows) {
  const skipped = [];
  const skip = (r, reason) => skipped.push({ file: r.file, empId: r.empId, name: r.name, reason, value: r.emailRaw });
  // One canonical spelling per department (STRUCTURE / Structure, PHE & FIRE / PHE & Fire).
  const spellings = new Map();
  for (const r of rows) if (r.department) { const k = r.department.toLowerCase(); (spellings.get(k) ?? spellings.set(k, new Map()).get(k)).set(r.department, ((spellings.get(k).get(r.department)) ?? 0) + 1); }
  const canonical = (dep) => { const m = spellings.get(dep.toLowerCase()); if (!m) return dep; return [...m.entries()].sort((a, b) => (/[a-z]/.test(b[0]) ? 1 : 0) - (/[a-z]/.test(a[0]) ? 1 : 0) || b[1] - a[1])[0][0]; };

  const kept = new Map(); // email -> row (first wins; a person listed in two branch files is imported once)
  for (const r of rows) {
    if (!/^DT-/i.test(r.empId) || !r.name) { skip(r, 'Not an employee row (no EMP ID / name).'); continue; }
    const email = cleanEmail(r.emailRaw);
    if (!email) { skip(r, 'Email missing.'); continue; }
    if (!EMAIL.test(email)) { skip(r, /left/i.test(r.emailRaw) ? 'Marked as left.' : 'No valid email.'); continue; }
    if (typoDomain(email)) { skip(r, `Email domain looks mistyped (@${email.split('@')[1]}); confirm the address.`); continue; }
    if (!r.designation) { skip(r, 'Designation missing.'); continue; }
    if (kept.has(email)) {
      const first = kept.get(email);
      // Same person in two files (Hyderabad + Vijayawada): keep the more specific branch file.
      if (first.empId === r.empId) { if (/vijayawada/i.test(r.file)) kept.set(email, { ...r, email }); }
      else skip(r, `Email ${email} is also given to ${first.empId}.`);
      continue;
    }
    kept.set(email, { ...r, email });
  }
  const roster = [...kept.values()].map((r) => ({ branch: r.branch || r.file.replace(/[-_ ]*2026.*$/i, ''), empId: r.empId, name: r.name, designation: r.designation, department: canonical(r.department), email: r.email, file: r.file }));
  return { roster, skipped };
}
