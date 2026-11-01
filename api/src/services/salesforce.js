// Read-only Salesforce client for the admin "Import from Salesforce" flow.
//
// Scope: authenticate with the OAuth 2.0 client-credentials flow, run SOQL
// against the configured project object, and normalise a record into the
// shape the New Project form already understands. Nothing here writes to
// Salesforce, and no credential ever leaves this module.
import { salesforceSettings } from '../config/salesforce.js';

const REQUEST_TIMEOUT_MS = 15_000;
// Client-credentials sessions last hours; refresh well before they expire.
const TOKEN_TTL_MS = 30 * 60 * 1000;

// Fields read from the project object. Kept in one place so a schema change
// is a single edit; INVALID_FIELD errors point back at this list.
const PROJECT_FIELDS = [
  'Id',
  'Name',
  'Project_Code__c',
  'Job_Numbers__c',
  'Used_For__c',
  'Entity_Name__c',
  'Customer_Group__c',
  'State__c',
  'Project_Type__c',
  'Branch_Name__c',
  'Location__c',
  'Service_Names__c',
  'Contact_Person_Name__c',
  'Project_Director__c',
  'Has_Work_Order__c',
  'LastModifiedDate',
];

// Present on the client's org but not on every fixture. They are selected
// only when the object's describe lists them, so a missing one is skipped
// instead of failing the whole query.
const OPTIONAL_FIELDS = [
  'Building_Street_Address__c',
  'Building_Street_Address_2__c',
  'City_and_State_Zip_Code__c',
  'Project_Director_Designation__c',
  'Project_Head__c',
  'Project_Head_Designation__c',
  'Has_Proposal__c',
];

// On the client's org these are lookups (Job Number, Entity, Customer Group,
// Contact), so the column holds a record id and the readable value lives on
// the relationship. On a dev org they may be plain text. The describe call
// decides which, per field.
const LOOKUP_FIELDS = [
  'Job_Numbers__c',
  'Entity_Name__c',
  'Customer_Group__c',
  'Contact_Person_Name__c',
];
const CONTACT_SUBFIELDS = ['Name', 'Salutation', 'Title', 'Email', 'Phone'];
const SCHEMA_TTL_MS = 60 * 60 * 1000;

// Salesforce service labels -> DesignTree canonical service codes.
const SERVICE_ALIASES = new Map([
  ['str', 'STR'],
  ['structural', 'STR'],
  ['structure', 'STR'],
  ['phe', 'PHE'],
  ['plumbing', 'PHE'],
  ['ele', 'ELE'],
  ['elec', 'ELE'],
  ['electrical', 'ELE'],
  ['hvac', 'HVAC'],
  ['mechanical', 'HVAC'],
  ['fire', 'FIRE'],
  ['fire fighting', 'FIRE'],
  ['firefighting', 'FIRE'],
  ['smep', 'SMEP'],
  ['smepf', 'SMEPF'],
  ['mep', 'MEP'],
  ['mep coordination', 'MEP'],
  ['bim', 'BIM'],
  ['gbs', 'GBS'],
  ['peer review', 'Peer Review'],
  ['peerreview', 'Peer Review'],
  ['peer', 'Peer Review'],
]);

export class SalesforceError extends Error {
  constructor(message, { status = 502, code = 'SALESFORCE_ERROR', detail } = {}) {
    super(message);
    this.name = 'SalesforceError';
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

function text(value) {
  return value == null ? '' : String(value).trim();
}

// Readable value of a field that is text on one org and a lookup on another.
// Never returns a bare Salesforce id: if the relationship was not selected the
// result is blank, so an id can not end up in the New Project form.
function lookupText(record, field, sub = 'Name') {
  const rel = field.replace(/__c$/, '__r');
  const related = record?.[rel];
  if (related && typeof related === 'object') return text(related[sub]);
  if (sub !== 'Name') return '';
  const raw = text(record?.[field]);
  return looksLikeId(raw) ? '' : raw;
}

// A bare Salesforce id: 15 or 18 letters and digits with both present. Job
// numbers such as "TS-2526-604" contain "-", so they never match.
function looksLikeId(value) {
  return /^(?:[A-Za-z0-9]{15}|[A-Za-z0-9]{18})$/.test(value) && /\d/.test(value) && /[A-Za-z]/.test(value);
}

function validEmail(value) {
  const v = text(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v.toLowerCase() : '';
}

function escapeSoqlString(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function escapeLike(value) {
  // Backslash is the LIKE escape character in SOQL.
  return escapeSoqlString(value).replace(/%/g, '\\%').replace(/_/g, '\\_');
}

export function mapServices(value) {
  const raw = text(value);
  if (!raw) return { services: [], unknown: [] };
  const parts = raw
    .split(/[,;|\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const services = [];
  const unknown = [];
  for (const part of parts) {
    const key = part.toLowerCase().replace(/\s+/g, ' ');
    const mapped = SERVICE_ALIASES.get(key);
    if (!mapped) {
      unknown.push(part);
    } else if (!services.includes(mapped)) {
      services.push(mapped);
    }
  }
  return { services, unknown };
}

export function resolveBranch(value, branches = []) {
  const raw = text(value);
  if (!raw) return { branch: '', unmatched: '' };
  const match = branches.find((name) => text(name).toLowerCase() === raw.toLowerCase());
  return match ? { branch: match, unmatched: '' } : { branch: '', unmatched: raw };
}

// Turn one Salesforce record into the New Project payload shape plus a list
// of things the admin must review. Salesforce-owned values are prefilled;
// DesignTree-owned workflow fields are never part of this object.
export function normalizeProject(
  record,
  { branches = [], objectName = 'Project__c', instanceUrl = '' } = {},
) {
  const name = text(record?.Name);
  const projectCode = text(record?.Project_Code__c);
  const jobNumber = lookupText(record, 'Job_Numbers__c');
  // Used For is often blank on real records; the work-order / proposal flags
  // are what the client maintains, so fall back to them.
  const usedFor =
    text(record?.Used_For__c) ||
    (record?.Has_Work_Order__c === true ? 'WO' : record?.Has_Proposal__c === true ? 'Proposal' : '');
  const entityName = lookupText(record, 'Entity_Name__c');
  const customerGroup = lookupText(record, 'Customer_Group__c');
  const contactName = lookupText(record, 'Contact_Person_Name__c');
  const contactEmail = validEmail(lookupText(record, 'Contact_Person_Name__c', 'Email'));
  const contactPhone = lookupText(record, 'Contact_Person_Name__c', 'Phone');
  const contactTitle = lookupText(record, 'Contact_Person_Name__c', 'Title');
  const contactSalutation = lookupText(record, 'Contact_Person_Name__c', 'Salutation');
  const locationLabel = text(record?.Location__c);
  const state = text(record?.State__c);

  const { services, unknown: unknownServices } = mapServices(record?.Service_Names__c);
  const { branch, unmatched } = resolveBranch(record?.Branch_Name__c, branches);

  const warnings = [];
  if (!name) warnings.push({ field: 'name', message: 'This Salesforce record has no project name.' });
  if (!projectCode) {
    warnings.push({
      field: 'code',
      message: 'No Project Code on the Salesforce record — DesignTree will generate one.',
    });
  }
  if (!entityName) warnings.push({ field: 'entityName', message: 'No Entity Name on the Salesforce record.' });
  if (!customerGroup) {
    warnings.push({
      field: 'clientName',
      message: 'No Customer Group on the Salesforce record — check the client before saving.',
    });
  }
  if (!locationLabel) warnings.push({ field: 'location', message: 'No Location on the Salesforce record.' });
  if (unmatched) {
    warnings.push({
      field: 'branch',
      message:
        branches.length === 0
          ? `Branch "${unmatched}" cannot be matched — no active DesignTree branches exist yet. Add the branch first.`
          : `Branch "${unmatched}" is not an active DesignTree branch. Choose one before saving.`,
    });
  }
  for (const value of unknownServices) {
    warnings.push({
      field: 'services',
      message: `Service "${value}" is not a DesignTree service and was left out.`,
    });
  }

  const prefill = {
    name,
    code: projectCode,
    jobNumber,
    usedFor,
    entityName,
    clientName: customerGroup,
    state,
    projectType: text(record?.Project_Type__c),
    branch,
    location: {
      label: locationLabel,
      address1: text(record?.Building_Street_Address__c),
      address2: text(record?.Building_Street_Address_2__c),
      // One free-text field on the Salesforce side ("City and State Zip Code").
      city: text(record?.City_and_State_Zip_Code__c),
      state,
      zip: '',
    },
    services,
    ...(contactName || customerGroup
      ? {
          contacts: {
            client: {
              ...(contactSalutation ? { salutation: contactSalutation } : {}),
              ...(contactName ? { name: contactName } : {}),
              ...(contactTitle ? { designation: contactTitle } : {}),
              ...(customerGroup ? { company: customerGroup } : {}),
              ...(contactPhone ? { phone: contactPhone } : {}),
              ...(contactEmail ? { email: contactEmail } : {}),
            },
          },
        }
      : {}),
    related: {
      ...(text(record?.Project_Director__c)
        ? { projectDirector: text(record.Project_Director__c) }
        : {}),
      ...(text(record?.Project_Director_Designation__c)
        ? { projectDirectorDesignation: text(record.Project_Director_Designation__c) }
        : {}),
      ...(text(record?.Project_Head__c) ? { projectHead: text(record.Project_Head__c) } : {}),
      ...(text(record?.Project_Head_Designation__c)
        ? { projectHeadDesignation: text(record.Project_Head_Designation__c) }
        : {}),
    },
  };

  return {
    source: {
      id: text(record?.Id),
      object: objectName,
      projectCode,
      usedFor,
      hasWorkOrder: record?.Has_Work_Order__c === true,
      lastModifiedAt: record?.LastModifiedDate ?? null,
      instanceUrl,
      url:
        instanceUrl && record?.Id
          ? `${instanceUrl}/lightning/r/${objectName}/${text(record.Id)}/view`
          : null,
    },
    prefill,
    warnings,
  };
}

export function createSalesforceService({
  settings = salesforceSettings,
  fetchImpl = globalThis.fetch,
  now = () => Date.now(),
} = {}) {
  const readSettings = typeof settings === 'function' ? settings : () => settings;
  let cachedToken = null;
  let inFlight = null;

  function clearToken() {
    cachedToken = null;
  }

  async function fetchToken() {
    const cfg = readSettings();
    if (!cfg.configured) {
      throw new SalesforceError(
        'Salesforce is not configured on this server.',
        { status: 503, code: 'SALESFORCE_NOT_CONFIGURED' },
      );
    }

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetchImpl(`${cfg.loginUrl}/services/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: controller.signal,
      });
      const raw = await res.text();
      let data = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = {};
      }
      if (!res.ok || !data.access_token) {
        const reason = data.error_description || data.error || `HTTP ${res.status}`;
        throw new SalesforceError(
          `Salesforce rejected the integration credentials: ${reason}`,
          { status: 502, code: 'SALESFORCE_AUTH', detail: raw },
        );
      }
      return {
        accessToken: data.access_token,
        instanceUrl: String(data.instance_url ?? cfg.loginUrl).replace(/\/+$/, ''),
        expiresAt: now() + TOKEN_TTL_MS,
      };
    } catch (err) {
      if (err?.name === 'AbortError') {
        throw new SalesforceError('Salesforce did not respond to the token request in time.', {
          status: 504,
          code: 'SALESFORCE_TIMEOUT',
        });
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  async function getToken() {
    if (cachedToken && cachedToken.expiresAt - 60_000 > now()) return cachedToken;
    if (!inFlight) {
      inFlight = fetchToken()
        .then((token) => {
          cachedToken = token;
          return token;
        })
        .finally(() => {
          inFlight = null;
        });
    }
    return inFlight;
  }

  function translateError(status, payload) {
    const first = Array.isArray(payload) ? payload[0] : payload;
    const code = first?.errorCode ?? first?.error ?? 'SALESFORCE_ERROR';
    const message =
      first?.message ?? first?.error_description ?? 'Salesforce request failed.';

    if (code === 'INVALID_FIELD' || /No such column/i.test(message)) {
      return new SalesforceError(
        'A field used by the connector does not exist on the Salesforce object. Update the field map or SF_PROJECT_OBJECT.',
        { status: 502, code: 'SALESFORCE_INVALID_FIELD', detail: message },
      );
    }
    if (status === 401 || code === 'INVALID_SESSION_ID') {
      return new SalesforceError(
        'Salesforce rejected the session. Check the integration user and the External Client App.',
        { status: 502, code: 'SALESFORCE_AUTH', detail: message },
      );
    }
    return new SalesforceError(message, { status: 502, code, detail: message });
  }

  async function apiRequest(path, { retry = true } = {}) {
    const cfg = readSettings();
    const token = await getToken();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetchImpl(`${token.instanceUrl}${path}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      if (res.status === 401 && retry) {
        clearToken();
        return apiRequest(path, { retry: false });
      }
      const raw = await res.text();
      let data = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = raw;
      }
      if (!res.ok) throw translateError(res.status, data);
      return data;
    } catch (err) {
      if (err?.name === 'AbortError') {
        throw new SalesforceError('Salesforce did not respond in time.', {
          status: 504,
          code: 'SALESFORCE_TIMEOUT',
        });
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  // Field types of the project object, from Salesforce's describe call. Used
  // to tell lookups from text and to skip optional fields the org lacks. If
  // describe fails the connector falls back to the plain-text field list.
  let cachedSchema = null;
  let schemaInFlight = null;

  async function loadSchema() {
    const cfg = readSettings();
    try {
      const data = await apiRequest(
        `/services/data/v${cfg.apiVersion}/sobjects/${cfg.projectObject}/describe`,
      );
      const fields = new Map();
      for (const f of Array.isArray(data?.fields) ? data.fields : []) {
        fields.set(f.name, {
          type: f.type,
          relationshipName: f.relationshipName ?? null,
          referenceTo: Array.isArray(f.referenceTo) ? f.referenceTo : [],
        });
      }
      return { object: cfg.projectObject, fields, loadedAt: now() };
    } catch (err) {
      if (err instanceof SalesforceError && err.code === 'SALESFORCE_AUTH') throw err;
      return { object: cfg.projectObject, fields: null, loadedAt: now() };
    }
  }

  async function getSchema() {
    const cfg = readSettings();
    if (
      cachedSchema &&
      cachedSchema.object === cfg.projectObject &&
      now() - cachedSchema.loadedAt < SCHEMA_TTL_MS
    ) {
      return cachedSchema;
    }
    if (!schemaInFlight) {
      schemaInFlight = loadSchema()
        .then((schema) => {
          cachedSchema = schema;
          return schema;
        })
        .finally(() => {
          schemaInFlight = null;
        });
    }
    return schemaInFlight;
  }

  // Relationship path for a lookup field, or null when the field is plain text.
  function lookupOf(schema, field) {
    const meta = schema.fields?.get(field);
    return meta?.type === 'reference' && meta.relationshipName ? meta : null;
  }

  async function selectClause() {
    const cfg = readSettings();
    const schema = await getSchema();
    const columns = [...PROJECT_FIELDS];
    if (schema.fields) {
      for (const field of OPTIONAL_FIELDS) if (schema.fields.has(field)) columns.push(field);
      for (const field of LOOKUP_FIELDS) {
        const meta = lookupOf(schema, field);
        if (!meta) continue;
        const subs =
          field === 'Contact_Person_Name__c' && meta.referenceTo.includes('Contact')
            ? CONTACT_SUBFIELDS
            : ['Name'];
        for (const sub of subs) columns.push(`${meta.relationshipName}.${sub}`);
      }
    }
    return { schema, soql: `SELECT ${columns.join(', ')} FROM ${cfg.projectObject}` };
  }

  async function searchProjects({ q, includeProposals = false, limit = 20 } = {}) {
    const term = text(q);
    if (term.length < 2) {
      throw new SalesforceError('Enter at least 2 characters to search Salesforce.', {
        status: 400,
        code: 'SEARCH_TERM_TOO_SHORT',
      });
    }

    const like = `'%${escapeLike(term)}%'`;
    const { schema, soql: selectSoql } = await selectClause();
    // LIKE does not work on a lookup column, so search the related record's name.
    const searchable = (field) => {
      const meta = lookupOf(schema, field);
      return meta ? `${meta.relationshipName}.Name` : field;
    };
    const matches = [
      `Name LIKE ${like}`,
      `Project_Code__c LIKE ${like}`,
      `${searchable('Customer_Group__c')} LIKE ${like}`,
      `${searchable('Entity_Name__c')} LIKE ${like}`,
      `${searchable('Job_Numbers__c')} LIKE ${like}`,
    ];
    const filters = [`(${matches.join(' OR ')})`];
    if (!includeProposals) filters.push('Has_Work_Order__c = true');

    const size = Math.min(50, Math.max(1, Number(limit) || 20));
    const cfg = readSettings();
    const soql = `${selectSoql} WHERE ${filters.join(' AND ')} ORDER BY LastModifiedDate DESC LIMIT ${size}`;
    const data = await apiRequest(
      `/services/data/v${cfg.apiVersion}/query?q=${encodeURIComponent(soql)}`,
    );

    return {
      instanceUrl: (await getToken()).instanceUrl,
      records: Array.isArray(data?.records) ? data.records : [],
    };
  }

  async function getProjectRecord(id) {
    const recordId = text(id);
    if (!/^(?:[A-Za-z0-9]{15}|[A-Za-z0-9]{18})$/.test(recordId)) {
      throw new SalesforceError('Invalid Salesforce record id.', {
        status: 400,
        code: 'INVALID_RECORD_ID',
      });
    }

    const cfg = readSettings();
    const { soql: selectSoql } = await selectClause();
    const soql = `${selectSoql} WHERE Id = '${recordId}' LIMIT 1`;
    const data = await apiRequest(
      `/services/data/v${cfg.apiVersion}/query?q=${encodeURIComponent(soql)}`,
    );
    const record = Array.isArray(data?.records) ? data.records[0] : null;
    if (!record) {
      throw new SalesforceError('Salesforce record not found.', {
        status: 404,
        code: 'SALESFORCE_NOT_FOUND',
      });
    }

    return { instanceUrl: (await getToken()).instanceUrl, record };
  }

  return {
    getToken,
    searchProjects,
    getProjectRecord,
    _clearToken: clearToken,
    _clearSchema: () => {
      cachedSchema = null;
    },
  };
}

export const salesforce = createSalesforceService();
