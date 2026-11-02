// Merges employee records that an earlier import run created for people who
// already had a record (e.g. linked to their login), back into that original
// record. Merges only when the match is unambiguous and nothing else in the app
// references the duplicate; everything else is reported for manual review.
import { exactName, normalizedEmail, normalizedName, rosterNameCounts } from './blrEmployeeImport.js';
import { expandServices } from '../config/services.js';

// Department -> service (Structure = Structural, PHE = Plumbing, ...) for comparisons.
const serviceOf = (dept) => expandServices([dept]).join('+').toLowerCase();

const id = (value) => String(value?._id ?? value ?? '');
const blank = (value) => value === undefined || value === null || String(value).trim() === '';
const fullName = (e) => [e.firstName, e.middleName, e.lastName].filter(Boolean).join(' ');
const AUTO_EMP_ID = /^EMP-\d+$/i;
const FILL = ['designation', 'department', 'branch', 'reportingManager', 'teamViewOf'];

// Every (model, path) in the app that stores an Employee reference, except the
// Employee collection itself and User.employee (handled explicitly).
export function employeeRefPaths(mongoose) {
  const out = [];
  const walk = (modelName, schema, prefix) => schema.eachPath((path, type) => {
    const full = prefix + path;
    const ref = type.options?.ref ?? type.caster?.options?.ref ?? type.options?.type?.[0]?.ref;
    if (ref === 'Employee') out.push([modelName, full]);
    if (type.schema) walk(modelName, type.schema, full + '.');
  });
  for (const name of mongoose.modelNames()) if (!['Employee', 'User'].includes(name)) walk(name, mongoose.model(name).schema, '');
  return out;
}

async function referenceCount(mongoose, refPaths, employeeId) {
  const hits = [];
  for (const [model, path] of refPaths) {
    const n = await mongoose.model(model).countDocuments({ [path]: employeeId });
    if (n) hits.push(`${model}.${path} (${n})`);
  }
  return hits;
}

export async function planRepair({ roster, Employee, User, mongoose, since }) {
  const [employees, users] = await Promise.all([
    Employee.find({}).select('_id empId firstName middleName lastName email user createdAt designation department branch reportingManager teamViewOf headOfDepartments').lean(),
    User.find({}).select('_id name email employee createdAt').lean(),
  ]);
  const refPaths = employeeRefPaths(mongoose);
  const nameCounts = rosterNameCounts(roster);
  const usersById = new Map(users.map((u) => [id(u), u]));
  const pairs = [];
  for (const row of roster) {
    if (!row.empId) continue;
    const holders = employees.filter((e) => String(e.empId ?? '').toUpperCase() === row.empId.toUpperCase());
    if (holders.length !== 1) continue;
    const dup = holders[0];
    // Only records shaped like an import-created one, created inside the window.
    if (!(new Date(dup.createdAt) >= since) || dup.middleName || dup.lastName || exactName(dup.firstName) !== exactName(row.name)) continue;
    const older = (e) => id(e) !== id(dup) && new Date(e.createdAt) < new Date(dup.createdAt);
    const email = normalizedEmail(row.email);
    const stages = [
      email ? users.filter((u) => normalizedEmail(u.email) === email && u.employee).map((u) => employees.find((e) => id(e) === id(u.employee))).filter(Boolean) : [],
      email ? employees.filter((e) => normalizedEmail(e.email) === email) : [],
      employees.filter((e) => {
        const same = (nameCounts.get(normalizedName(row.name)) ?? 0) <= 1 ? normalizedName(fullName(e)) === normalizedName(row.name) : exactName(fullName(e)) === exactName(row.name);
        const idOk = !e.empId || AUTO_EMP_ID.test(String(e.empId));
        const mailOk = !e.email || !email || normalizedEmail(e.email) === email;
        return same && idOk && mailOk;
      }),
    ].map((list) => [...new Map(list.filter(older).map((e) => [id(e), e])).values()]);
    let candidates = stages.find((list) => list.length) ?? [];
    if (!candidates.length) continue;
    // Several same-name records: keep only those in the list's department (if that leaves one).
    if (candidates.length > 1) {
      const sameDept = candidates.filter((e) => e.department && serviceOf(e.department) === serviceOf(row.department));
      if (sameDept.length === 1) candidates = sameDept;
    }
    const base = { name: row.name, empId: row.empId, duplicateId: id(dup) };
    if (candidates.length > 1) { pairs.push({ ...base, action: 'review', reason: `Several older records could be this person (${candidates.map((e) => e.empId || e.email || id(e)).join('; ')}).` }); continue; }
    const orig = candidates[0];
    if (orig.department && serviceOf(orig.department) !== serviceOf(row.department)) {
      pairs.push({ ...base, originalId: id(orig), action: 'review', reason: `Existing record "${fullName(orig)}" is in ${orig.department}, the list says ${row.department}; not merged.` }); continue;
    }
    const origId = String(orig.empId ?? '');
    if (origId && !AUTO_EMP_ID.test(origId) && origId.toUpperCase() !== row.empId.toUpperCase()) {
      pairs.push({ ...base, originalId: id(orig), action: 'review', reason: `Older record has a different EMP ID (${origId}).` }); continue;
    }
    // Login handling: a login created on the duplicate may move to the original only if it has none.
    let moveLogin = null;
    if (dup.user) {
      const login = usersById.get(id(dup.user));
      const loginIsNew = login && new Date(login.createdAt) >= since;
      if (!loginIsNew) { pairs.push({ ...base, originalId: id(orig), action: 'review', reason: 'Duplicate record has an older login attached.' }); continue; }
      if (orig.user && id(orig.user) !== id(login)) { pairs.push({ ...base, originalId: id(orig), action: 'review', reason: `Both records have different logins (${login.email} and the original's).` }); continue; }
      if (login.employee && id(login.employee) !== id(dup)) { pairs.push({ ...base, originalId: id(orig), action: 'review', reason: 'Login link is inconsistent.' }); continue; }
      moveLogin = id(login);
    }
    const refs = await referenceCount(mongoose, refPaths, dup._id);
    if (refs.length) { pairs.push({ ...base, originalId: id(orig), action: 'referenced', reason: `Duplicate is already used in: ${refs.join(', ')}.` }); continue; }
    const stage = stages.findIndex((list) => list.some((e) => id(e) === id(orig)));
    pairs.push({ ...base, originalId: id(orig), originalLabel: fullName(orig) || orig.email, how: ['login', 'email', 'name'][stage] ?? 'name', action: 'merge', moveLogin });
  }
  return pairs;
}

export async function applyRepair({ pairs, Employee, User }) {
  const results = [];
  for (const pair of pairs) {
    if (pair.action !== 'merge') { results.push({ name: pair.name, empId: pair.empId, status: pair.action, reason: pair.reason }); continue; }
    const copy = await Employee.findById(pair.duplicateId).lean();
    const orig = await Employee.findById(pair.originalId);
    if (!copy || !orig) { results.push({ name: pair.name, empId: pair.empId, status: 'skipped', reason: 'Record changed since planning.' }); continue; }
    let deleted = false, movedLogin = false;
    try {
      await Employee.deleteOne({ _id: copy._id });
      deleted = true;
      if (blank(orig.empId) || AUTO_EMP_ID.test(String(orig.empId))) orig.empId = copy.empId;
      for (const field of FILL) if (blank(orig[field]) && !blank(copy[field])) orig[field] = copy[field];
      if (blank(orig.email) && copy.email && !(await Employee.exists({ email: copy.email, _id: { $ne: orig._id } }))) orig.email = copy.email;
      if (copy.headOfDepartments?.length) orig.headOfDepartments = [...new Set([...(orig.headOfDepartments ?? []), ...copy.headOfDepartments])];
      if (pair.moveLogin && !orig.user) {
        await User.updateOne({ _id: pair.moveLogin, employee: copy._id }, { $set: { employee: orig._id } });
        orig.user = pair.moveLogin; movedLogin = true;
      }
      await orig.save();
      results.push({ name: pair.name, empId: pair.empId, status: 'merged', into: pair.originalLabel, matchedBy: pair.how, loginMoved: movedLogin });
    } catch (error) {
      // Put everything back exactly as it was.
      if (movedLogin) await User.updateOne({ _id: pair.moveLogin }, { $set: { employee: copy._id } });
      if (deleted) await Employee.collection.insertOne(copy);
      results.push({ name: pair.name, empId: pair.empId, status: 'failed', reason: error.message });
    }
  }
  return results;
}
