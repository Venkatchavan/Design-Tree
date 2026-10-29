// Admin-only Salesforce endpoints.
//
// Read-only on purpose: these handlers fetch project records from Salesforce
// and return them normalised for the New Project form. Nothing is written
// back, and an imported project keeps only a reference to the Salesforce
// record id (see createProject).
import { Project } from '../models/Project.js';
import {
  SalesforceError,
  normalizeProject,
  salesforce,
} from '../services/salesforce.js';
import { activeBranchNames } from '../utils/branches.js';
import { salesforceSettings } from '../config/salesforce.js';

function sendSalesforceError(res, err) {
  if (err instanceof SalesforceError) {
    return res.status(err.status).json({
      message: err.message,
      code: err.code,
    });
  }
  throw err;
}

async function existingProjectsFor(records) {
  const ids = records.map((r) => r?.Id).filter(Boolean);
  if (ids.length === 0) return new Map();
  const rows = await Project.find(
    { salesforceRecordId: { $in: ids } },
    { _id: 1, name: 1, code: 1, salesforceRecordId: 1 },
  ).lean();
  return new Map(rows.map((row) => [row.salesforceRecordId, row]));
}

// GET /api/integrations/salesforce/status
// Cheap configuration probe used by the New Project page. Never returns
// credentials — only whether the server has them and which object is read.
export function salesforceStatus(_req, res) {
  const cfg = salesforceSettings();
  return res.status(200).json({
    configured: cfg.configured,
    object: cfg.projectObject,
    apiVersion: cfg.apiVersion,
  });
}

// GET /api/integrations/salesforce/projects?q=...&includeProposals=1
export async function searchSalesforceProjects(req, res, next) {
  try {
    const branches = await activeBranchNames();
    const data = await salesforce.searchProjects({
      q: req.query.q,
      includeProposals: req.query.includeProposals === '1',
      limit: req.query.limit,
    });
    const existing = await existingProjectsFor(data.records);
    const items = data.records.map((record) =>
      normalizeProject(record, {
        branches,
        objectName: salesforceSettings().projectObject,
        instanceUrl: data.instanceUrl,
      }),
    );
    return res.status(200).json({
      instanceUrl: data.instanceUrl,
      total: items.length,
      items: items.map((item) => ({
        ...item,
        existingProject: existing.get(item.source.id) ?? null,
      })),
    });
  } catch (err) {
    if (err instanceof SalesforceError) return sendSalesforceError(res, err);
    return next(err);
  }
}

// GET /api/integrations/salesforce/projects/:id
export async function getSalesforceProject(req, res, next) {
  try {
    const branches = await activeBranchNames();
    const data = await salesforce.getProjectRecord(req.params.id);
    const normalized = normalizeProject(data.record, {
      branches,
      objectName: salesforceSettings().projectObject,
      instanceUrl: data.instanceUrl,
    });
    const existing = await Project.findOne(
      { salesforceRecordId: normalized.source.id },
      { _id: 1, name: 1, code: 1 },
    ).lean();
    return res.status(200).json({
      ...normalized,
      existingProject: existing ?? null,
    });
  } catch (err) {
    if (err instanceof SalesforceError) return sendSalesforceError(res, err);
    return next(err);
  }
}
