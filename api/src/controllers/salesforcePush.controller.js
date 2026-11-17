// POST /api/integrations/salesforce/push
//
// Public (no user session) but never anonymous: every request must carry a
// valid HMAC signature made with SF_PUSH_SECRET. Response shape follows the
// agreed `{ status, data: [...] }` contract.
import { salesforceSettings } from '../config/salesforce.js';
import {
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  extractRecords,
  upsertPushedProject,
  verifySignature,
} from '../services/salesforcePush.js';
import { activeBranchNames } from '../utils/branches.js';

const MAX_RECORDS_PER_PUSH = 200;

function failure(res, httpStatus, code, message, extra = {}) {
  return res.status(httpStatus).json({ status: 'error', code, message, ...extra });
}

export async function receiveSalesforcePush(req, res, next) {
  try {
    const cfg = salesforceSettings();
    if (!cfg.pushConfigured) {
      return failure(res, 503, 'NOT_CONFIGURED', 'Salesforce push is not configured on this server.');
    }

    const auth = verifySignature({
      secret: cfg.pushSecret,
      rawBody: req.rawBody ?? Buffer.alloc(0),
      signatureHeader: req.get(SIGNATURE_HEADER),
      timestampHeader: req.get(TIMESTAMP_HEADER),
    });
    if (!auth.ok) {
      // One message for every signature problem: do not tell a caller which
      // part was wrong.
      return failure(res, 401, 'UNAUTHORIZED', 'Invalid or missing signature.');
    }

    const records = extractRecords(req.body);
    if (records.length === 0) {
      return failure(res, 400, 'NO_RECORDS', 'Send at least one project record in data.');
    }
    if (records.length > MAX_RECORDS_PER_PUSH) {
      return failure(res, 413, 'TOO_MANY_RECORDS', `Send at most ${MAX_RECORDS_PER_PUSH} records per request.`);
    }

    const branches = await activeBranchNames();
    const data = [];
    for (const record of records) {
      data.push(await upsertPushedProject(record, { branches }));
    }

    // Success only when every record is stored (or already held in a newer
    // version). Salesforce marks a record Synced on this response, so a
    // rejected record must produce an error. Retrying is safe: it is an update.
    const rejected = data.filter((row) => row.result === 'rejected');
    if (rejected.length > 0) {
      return res.status(422).json({
        status: 'error',
        code: 'RECORDS_REJECTED',
        message: `${rejected.length} of ${data.length} record(s) were not accepted.`,
        data,
      });
    }
    return res.status(200).json({ status: 'success', data });
  } catch (err) {
    return next(err);
  }
}
