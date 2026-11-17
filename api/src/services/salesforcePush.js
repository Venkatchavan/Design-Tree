// Inbound Salesforce -> DT-MIS project push.
//
// Salesforce calls POST /api/integrations/salesforce/push when an eligible
// project (one with a Job Number) is created or changed. This module holds the
// parts that do not depend on Express: verifying the HMAC signature, mapping a
// pushed record onto the project shape, and creating or updating the project.
//
// Rules (agreed with the client, 6-13 Nov 2026):
//  - only records with a Job Number are accepted;
//  - the Salesforce record Id is the match key; a replay or retry is an update;
//  - a record older than the one already stored is acknowledged and ignored;
//  - success is returned only after the project is saved, because Salesforce
//    ticks its "Synced" checkbox (which blocks deletion) on that response;
//  - an unknown branch or service never rejects the push; it is saved blank
//    and flagged for Admin review.
import crypto from 'node:crypto';
import { Project } from '../models/Project.js';
import { activeBranchNames } from '../utils/branches.js';
import { normalizeProject } from './salesforce.js';

export const SIGNATURE_HEADER = 'x-dt-signature';
export const TIMESTAMP_HEADER = 'x-dt-timestamp';
export const TIMESTAMP_TOLERANCE_SECONDS = 5 * 60;

const SALESFORCE_ID = /^(?:[A-Za-z0-9]{15}|[A-Za-z0-9]{18})$/;

function text(value) {
  return value == null ? '' : String(value).trim();
}

// ---------------------------------------------------------------- signature

// Signature = hex(HMAC-SHA256(secret, `${timestamp}.${rawBody}`)), sent as
// `X-DT-Signature: sha256=<hex>` with `X-DT-Timestamp: <unix seconds>`.
// The timestamp is part of the signed text so a captured request cannot be
// replayed later.
export function signPayload(secret, timestamp, rawBody) {
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody ?? ''), 'utf8');
  return crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.`)
    .update(body)
    .digest('hex');
}

export function verifySignature({
  secret,
  rawBody,
  signatureHeader,
  timestampHeader,
  nowSeconds = Math.floor(Date.now() / 1000),
}) {
  if (!secret) return { ok: false, reason: 'NOT_CONFIGURED' };
  const timestamp = text(timestampHeader);
  const provided = text(signatureHeader).replace(/^sha256=/i, '').toLowerCase();
  if (!timestamp || !provided) return { ok: false, reason: 'MISSING_SIGNATURE' };
  if (!/^\d{9,13}$/.test(timestamp)) return { ok: false, reason: 'BAD_TIMESTAMP' };
  // Accept seconds or milliseconds.
  const sent = timestamp.length > 10 ? Math.floor(Number(timestamp) / 1000) : Number(timestamp);
  if (Math.abs(nowSeconds - sent) > TIMESTAMP_TOLERANCE_SECONDS) {
    return { ok: false, reason: 'STALE_TIMESTAMP' };
  }
  const expected = signPayload(secret, timestamp, rawBody);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(provided, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: 'BAD_SIGNATURE' };
  }
  return { ok: true };
}

// ------------------------------------------------------------------ mapping

// The client's sample payload is not final: keys have stray spaces and differ
// from the field list (`Job_Number` vs `Job_Numbers__c`). Keys are therefore
// compared after trimming, dropping `__c` / `__r` and underscores, lowercasing.
function keyOf(key) {
  return String(key)
    .trim()
    .replace(/__[cr]$/i, '')
    .replace(/[\s_]+/g, '')
    .toLowerCase();
}

// canonical Salesforce API name -> accepted keys (already in keyOf form)
const FIELD_ALIASES = {
  Id: ['id', 'recordid', 'salesforceid'],
  Name: ['name', 'projectname'],
  Project_Code__c: ['projectcode', 'code'],
  Job_Numbers__c: ['jobnumbers', 'jobnumber'],
  Used_For__c: ['usedfor'],
  Entity_Name__c: ['entityname', 'entity'],
  Customer_Group__c: ['customergroup'],
  State__c: ['state'],
  Project_Type__c: ['projecttype'],
  Branch_Name__c: ['branchname', 'branch'],
  Location__c: ['location'],
  Service_Names__c: ['servicenames', 'services', 'servicename'],
  Contact_Person_Name__c: ['contactpersonname', 'contactperson'],
  Project_Director__c: ['projectdirector'],
  Project_Director_Designation__c: ['projectdirectordesignation'],
  Project_Head__c: ['projecthead'],
  Project_Head_Designation__c: ['projectheaddesignation'],
  Has_Work_Order__c: ['hasworkorder'],
  Has_Proposal__c: ['hasproposal'],
  Building_Street_Address__c: ['buildingstreetaddress'],
  Building_Street_Address_2__c: ['buildingstreetaddress2'],
  City_and_State_Zip_Code__c: ['cityandstatezipcode'],
  LastModifiedDate: ['lastmodifieddate', 'lastmodified'],
  Pin_Code__c: ['pincode', 'zipcode', 'zip', 'postalcode'],
};

const CANONICAL_BY_KEY = new Map();
for (const [canonical, keys] of Object.entries(FIELD_ALIASES)) {
  for (const key of keys) CANONICAL_BY_KEY.set(key, canonical);
  CANONICAL_BY_KEY.set(keyOf(canonical), canonical);
}

// A lookup may arrive as plain text or as `{ Name: '...' }`. Contact lookups
// keep their sub-fields so normalizeProject can read email and phone.
function flattenValue(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const entries = Object.entries(value);
    const named = entries.find(([k]) => keyOf(k) === 'name');
    return named ? text(named[1]) : '';
  }
  return value;
}

// Trim keys and values and rename to the Salesforce API names that
// normalizeProject understands. Unknown keys are dropped.
export function canonicalizeRecord(raw) {
  const record = {};
  for (const [key, value] of Object.entries(raw ?? {})) {
    const canonical = CANONICAL_BY_KEY.get(keyOf(key));
    if (!canonical) continue;
    const flat = flattenValue(value);
    record[canonical] = typeof flat === 'string' ? flat.trim() : flat;
    // Keep a nested contact record intact for email / phone / title.
    if (canonical === 'Contact_Person_Name__c' && value && typeof value === 'object') {
      record.Contact_Person_Name__r = value;
    }
  }
  return record;
}

// Salesforce sends "2026-11-11T11:33:42.000+0000"; some runtimes reject the
// offset without a colon, so normalise it first.
export function parseSalesforceDate(value) {
  const raw = text(value);
  if (!raw) return null;
  const fixed = raw.replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
  const date = new Date(fixed);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Pushed body -> list of raw records. Accepts `{ status, data: [...] }`,
// `{ data: {...} }`, a bare array, or a single bare record.
export function extractRecords(body) {
  if (Array.isArray(body)) return body;
  if (body && typeof body === 'object') {
    if (Array.isArray(body.data)) return body.data;
    if (body.data && typeof body.data === 'object') return [body.data];
    if (body.Id || body.id) return [body];
  }
  return [];
}

// ------------------------------------------------------------------- upsert

function reject(id, code, message) {
  return { Id: id || null, result: 'rejected', code, message };
}

// Fields Salesforce owns and overwrites on every update. Everything else on
// the project (services, contacts, team leads, stages, fees) belongs to DT-MIS
// and is left alone after the first import.
function salesforceOwnedUpdate(prefill, { hasBranch }) {
  const update = {
    name: prefill.name,
    entityName: prefill.entityName,
    state: prefill.state,
    projectType: prefill.projectType,
    usedFor: prefill.usedFor,
    location: prefill.location,
  };
  if (prefill.clientName) update.clientName = prefill.clientName;
  if (hasBranch) update.branch = prefill.branch;
  for (const [key, value] of Object.entries(prefill.related ?? {})) {
    update[`related.${key}`] = value;
  }
  return update;
}

async function notifyNewProject(project) {
  // Best-effort, same wiring as an Admin-created project; the push itself has
  // already succeeded by the time this runs.
  try {
    const { DesignWorkflow } = await import('../models/DesignWorkflow.js');
    await DesignWorkflow.findOneAndUpdate(
      { project: project._id },
      { $setOnInsert: { project: project._id, steps: [], matrix: [] } },
      { upsert: true },
    );
    const { notify } = await import('../models/Notification.js');
    await notify({
      roles: ['design_mgmt_head'],
      project: project._id,
      link: { view: 'design-mgmt', id: project._id.toString() },
      title: `New project from Salesforce: ${project.name} (${project.code})`,
      detail: 'Review scope & requirements and identify required disciplines.',
      type: 'project-created',
    });
    await notify({
      roles: ['founding_director', 'working_director', 'executive_director', 'associate_director', 'technical_director'],
      project: project._id,
      link: { view: 'project-detail', id: project._id.toString() },
      title: `New project from Salesforce: ${project.name} (${project.code})`,
      detail: 'Created automatically from Salesforce. Check the details and activate it.',
      type: 'project-created',
    });
  } catch {
    /* project is saved; notifications are best-effort */
  }
}

export async function upsertPushedProject(raw, { branches } = {}) {
  const record = canonicalizeRecord(raw);
  const id = text(record.Id);
  if (!SALESFORCE_ID.test(id)) {
    return reject(id, 'INVALID_ID', 'Id must be a 15 or 18 character Salesforce record id.');
  }

  const branchNames = branches ?? (await activeBranchNames());
  const { prefill, warnings } = normalizeProject(record, { branches: branchNames });
  const zip = text(record.Pin_Code__c);
  if (zip) prefill.location = { ...prefill.location, zip };

  if (!prefill.name) return reject(id, 'MISSING_NAME', 'Project name is required.');

  const sentAt = parseSalesforceDate(record.LastModifiedDate);
  if (record.LastModifiedDate && !sentAt) {
    return reject(id, 'INVALID_DATE', 'LastModifiedDate is not a valid date.');
  }

  const review = warnings
    .filter((w) => w.field === 'branch' || w.field === 'services')
    .map((w) => w.message);
  const existing = await Project.findOne({ salesforceRecordId: id });

  // ------------------------------------------------------------ eligibility
  if (!prefill.jobNumber) {
    // A Job Number removed after the first sync keeps the project and flags it.
    if (existing) {
      existing.salesforceWarnings = [
        ...new Set([...(existing.salesforceWarnings ?? []), 'Salesforce sent this project without a Job Number.']),
      ];
      existing.salesforceSyncedAt = new Date();
      await existing.save();
      return {
        Id: id,
        result: 'flagged',
        projectCode: existing.code,
        message: 'Project kept and flagged for review: no Job Number was sent.',
      };
    }
    return reject(id, 'NOT_ELIGIBLE', 'Only projects with a Job Number are synchronised.');
  }

  // ----------------------------------------------------------------- update
  if (existing) {
    const stored = existing.salesforceLastModifiedAt;
    if (sentAt && stored && sentAt.getTime() < stored.getTime()) {
      return { Id: id, result: 'skipped', projectCode: existing.code, message: 'A newer version is already stored.' };
    }
    const update = salesforceOwnedUpdate(prefill, { hasBranch: Boolean(prefill.branch) });
    existing.set(update);
    existing.jobNumber = prefill.jobNumber;
    existing.salesforceProjectCode = text(record.Project_Code__c);
    if (sentAt) existing.salesforceLastModifiedAt = sentAt;
    existing.salesforceSyncedAt = new Date();
    existing.salesforceWarnings = review;
    await existing.save();
    return { Id: id, result: 'updated', projectCode: existing.code, warnings: review };
  }

  // ----------------------------------------------------------------- create
  const code = (text(record.Project_Code__c) || (await nextProjectCode())).toUpperCase();
  try {
    const project = await Project.create({
      name: prefill.name,
      code,
      jobNumber: prefill.jobNumber,
      usedFor: prefill.usedFor,
      entityName: prefill.entityName,
      clientName: prefill.clientName,
      state: prefill.state,
      projectType: prefill.projectType,
      branch: prefill.branch,
      location: prefill.location,
      services: prefill.services,
      contacts: prefill.contacts,
      related: prefill.related,
      // No user is involved in a push: Admin reviews and activates it.
      activation: { status: 'Pending' },
      salesforceRecordId: id,
      salesforceObject: 'Project__c',
      salesforceProjectCode: text(record.Project_Code__c),
      salesforceLastModifiedAt: sentAt ?? undefined,
      salesforceSyncedAt: new Date(),
      salesforceWarnings: review,
    });
    await notifyNewProject(project);
    return { Id: id, result: 'created', projectCode: project.code, warnings: review };
  } catch (err) {
    if (err?.code === 11000) {
      // Lost a race with a retry of the same record: it now exists.
      if (err?.keyPattern?.salesforceRecordId) {
        const again = await Project.findOne({ salesforceRecordId: id }, { code: 1 }).lean();
        return { Id: id, result: 'updated', projectCode: again?.code ?? code, warnings: review };
      }
      return reject(id, 'CODE_CONFLICT', `Project code ${code} already belongs to a different project.`);
    }
    throw err;
  }
}

// Imported lazily to avoid a controller <-> service import cycle at load time.
async function nextProjectCode() {
  const { generateProjectCode } = await import('../controllers/projects.controller.js');
  return generateProjectCode();
}
