import { Notification } from '../models/Notification.js';

// Relevance-scoped bell feed (§2.5): a notification is relevant when
// addressed to the reader's role (broadcasts) OR to them personally
// (invites, assignments, decisions). Legacy role-only docs keep matching.
export async function myNotifications(req, res, next) {
  try {
    const items = await Notification.find({
      $or: [{ roles: req.user.role }, { users: req.user.id }],
    })
      .sort({ createdAt: -1 })
      .limit(40);
    const unread = items.filter((n) =>
      !n.readBy.some((u) => u.toString() === req.user.id),
    ).length;
    return res.status(200).json({
      items: items.map((n) => ({
        id: n._id.toString(),
        title: n.title,
        detail: n.detail,
        type: n.type,
        at: n.createdAt,
        read: n.readBy.some((u) => u.toString() === req.user.id),
        link: n.link?.view || n.link?.id ? { view: n.link.view, id: n.link.id } : undefined,
        project: n.project ? String(n.project) : undefined,
      })),
      unread,
    });
  } catch (err) {
    return next(err);
  }
}

export async function markRead(req, res, next) {
  try {
    // Scoped to the reader's own relevant docs (no cross-user marking).
    const doc = await Notification.findOneAndUpdate(
      {
        _id: req.params.id,
        $or: [{ roles: req.user.role }, { users: req.user.id }],
      },
      { $addToSet: { readBy: req.user.id } },
    );
    if (!doc) return res.status(404).json({ message: 'Not found.' });
    return res.status(200).json({ ok: true });
  } catch (err) {
    return next(err);
  }
}

export async function markAllRead(req, res, next) {
  try {
    await Notification.updateMany(
      { $or: [{ roles: req.user.role }, { users: req.user.id }] },
      { $addToSet: { readBy: req.user.id } },
    );
    return res.status(200).json({ ok: true });
  } catch (err) {
    return next(err);
  }
}
