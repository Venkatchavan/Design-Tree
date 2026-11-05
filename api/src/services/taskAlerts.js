import { istDayKey } from '../config/attendance.js';
import { notify, userIdsForEmployees } from '../models/Notification.js';
import { Task } from '../models/Task.js';

// Tasks still awaiting the assignee's submission.
const PENDING = ['Open', 'In Progress', 'Needs Attention'];
const DAY_MS = 24 * 3600 * 1000;
const label = (t) => [t.stage, t.deliverable].filter(Boolean).join(' · ') || 'Assigned task';

// Bell alerts for assigned work: once when the due date is today or tomorrow
// (IST), once when it has passed without a submission. Assignees get both;
// the TL who assigned it is told about the overdue one. Each fires once per task.
export async function runTaskAlerts(now = new Date()) {
  const today = istDayKey(now);
  const tomorrow = istDayKey(new Date(now.getTime() + DAY_MS));
  const tasks = await Task.find({
    status: { $in: PENDING },
    dueDate: { $ne: null },
    $or: [{ dueSoonNotifiedAt: null }, { overdueNotifiedAt: null }],
  }).populate('project', 'name').lean();
  let sent = 0;
  for (const t of tasks) {
    const due = istDayKey(new Date(t.dueDate));
    const kind = due < today ? 'overdue' : due <= tomorrow ? 'soon' : null;
    if (!kind) continue;
    const field = kind === 'overdue' ? 'overdueNotifiedAt' : 'dueSoonNotifiedAt';
    if (t[field]) continue;
    // Claim first so two API instances never double-send.
    const claimed = await Task.updateOne({ _id: t._id, [field]: null }, { $set: { [field]: now } });
    if (!claimed.modifiedCount) continue;
    const users = await userIdsForEmployees(t.members);
    const project = t.project?.name ? ` (${t.project.name})` : '';
    const when = due === today ? 'today' : due === tomorrow ? 'tomorrow' : `on ${due}`;
    if (users.length) {
      await notify({
        users, project: t.project?._id, link: { view: 'my-work' },
        type: kind === 'overdue' ? 'task-overdue' : 'task-due-soon',
        title: kind === 'overdue' ? `Overdue: ${label(t)}${project}` : `Due ${when}: ${label(t)}${project}`,
        detail: kind === 'overdue' ? `Not submitted by the due date, ${due}.` : 'Submit before the due date.',
      });
    }
    if (kind === 'overdue' && t.createdBy) {
      await notify({
        users: [t.createdBy], project: t.project?._id, link: { view: 'my-team' }, type: 'task-overdue',
        title: `Assigned work not submitted: ${label(t)}${project}`,
        detail: `Due ${due}; the assignee has not submitted it.`,
      });
    }
    sent += 1;
  }
  return sent;
}

// Hourly sweep, plus one shortly after start-up. Unref'd so it never holds the process open.
export function startTaskAlerts({ intervalMs = 3600000 } = {}) {
  const run = () => runTaskAlerts().catch(() => {});
  setTimeout(run, 60000).unref();
  return setInterval(run, intervalMs).unref();
}
