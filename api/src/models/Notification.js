import mongoose from 'mongoose';

// In-app notifications (§2.5) with relevance-scoped delivery.
// A notification reaches a reader when it is addressed to their role
// (broadcasts, e.g. approver queues) OR to them specifically (users,
// e.g. meeting invitees, action assignees, leave requesters).
const linkSchema = new mongoose.Schema(
  {
    view: { type: String, trim: true },
    id: { type: String, trim: true },
  },
  { _id: false },
);

const notificationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    detail: { type: String, trim: true },
    roles: [{ type: String, trim: true, index: true }],
    users: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true,
      },
    ],
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      index: true,
    },
    link: { type: linkSchema },
    type: { type: String, trim: true },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true },
);

notificationSchema.index({ createdAt: -1 });

export const Notification =
  mongoose.models.Notification ??
  mongoose.model('Notification', notificationSchema);

export async function notifyRoles(roles, { title, detail, type }) {
  return notify({ roles, title, detail, type });
}

function toObjectIds(values) {
  const out = [];
  for (const v of values ?? []) {
    if (v == null || v === '') continue;
    if (typeof v === 'string' && /^[0-9a-fA-F]{24}$/.test(v)) {
      out.push(new mongoose.Types.ObjectId(v));
      continue;
    }
    if (typeof v?.toString === 'function') {
      const s = v.toString();
      if (/^[0-9a-fA-F]{24}$/.test(s)) out.push(new mongoose.Types.ObjectId(s));
    }
  }
  return out;
}

// Resolve User ids for a list of Employee ids (relevance targeting).
// Employees without a linked login are skipped (nothing to push to).
export async function userIdsForEmployees(employeeIds) {
  const valid = (employeeIds ?? []).filter((e) =>
    /^[0-9a-fA-F]{24}$/.test(String(e?._id ?? e ?? '')),
  );
  if (valid.length === 0) return [];
  const { User } = await import('./User.js');
  const users = await User.find({
    employee: { $in: valid.map((e) => e?._id ?? e) },
  })
    .select('_id')
    .lean();
  return users.map((u) => String(u._id));
}

// Central emit: persist the bell record, then push it live over socket.io.
// Push is best-effort — the bell feed stays the source of truth, so a
// failed emit must never fail the API call that triggered it.
export async function notify({ roles, users, project, link, title, detail, type }) {
  if (!roles?.length && !users?.length) return null;
  const doc = await Notification.create({
    title,
    detail,
    roles: roles ?? [],
    users: toObjectIds(users),
    project: /^[0-9a-fA-F]{24}$/.test(String(project?._id ?? project ?? ''))
      ? (project?._id ?? project)
      : undefined,
    link: link?.view || link?.id ? { view: link.view, id: link.id ? String(link.id) : undefined } : undefined,
    type,
  });
  try {
    const { emitNotification } = await import('../realtime/io.js');
    emitNotification(doc);
  } catch {
    /* bell record is saved; live push retries on next poll */
  }
  return doc;
}
