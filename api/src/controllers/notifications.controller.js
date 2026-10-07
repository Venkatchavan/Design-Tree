import { Notification } from '../models/Notification.js';

// Role-scoped bell feed (§2.5). A notification is relevant when addressed
// to the reader's role.
export async function myNotifications(req, res, next) {
  try {
    const role = req.user.role;
    const items = await Notification.find({ roles: role })
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
      })),
      unread,
    });
  } catch (err) {
    return next(err);
  }
}

export async function markRead(req, res, next) {
  try {
    await Notification.findByIdAndUpdate(req.params.id, {
      $addToSet: { readBy: req.user.id },
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    return next(err);
  }
}

export async function markAllRead(req, res, next) {
  try {
    await Notification.updateMany(
      { roles: req.user.role },
      { $addToSet: { readBy: req.user.id } },
    );
    return res.status(200).json({ ok: true });
  } catch (err) {
    return next(err);
  }
}
