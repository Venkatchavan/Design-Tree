export const MEETING_SERVICES = [
  'Structural',
  'Mechanical',
  'Electrical',
  'Plumbing',
  'Fire',
  'MEP Coordination',
];

export const SERVICE_CODES = {
  structural: 'S',
  mechanical: 'M',
  electrical: 'E',
  plumbing: 'P',
  fire: 'F',
  'mep coordination': 'MC',
  smepf: 'SMEPF',
};

export function serviceCode(s) {
  const key = String(s ?? '').toLowerCase();
  if (SERVICE_CODES[key]) return SERVICE_CODES[key];
  return String(s ?? '').slice(0, 2).toUpperCase() || '—';
}

export const CONDUCTED_BY_BY_TYPE = {
  'Client / DRM': ['Client', 'DRM'],
  'DesignTree / Arictech': ['DesignTree', 'Arictech'],
  PMC: ['PMC'],
  Other: ['Other'],
};

export function conductedByOptions(type, projectTeam = []) {
  const base = CONDUCTED_BY_BY_TYPE[type] ?? ['Other'];
  const names = (projectTeam ?? [])
    .map((m) => {
      const e = m?.employee ?? {};
      return [e.firstName, e.lastName].filter(Boolean).join(' ');
    })
    .filter(Boolean);
  const merged = [...base];
  for (const n of names) {
    if (!merged.includes(n)) merged.push(n);
  }
  return merged;
}

export function idOf(v) {
  if (v == null) return '';
  if (typeof v === 'object') return String(v._id ?? v.id ?? '');
  return String(v);
}

export function momRecorded(m) {
  const mom = m?.mom && typeof m.mom === 'object' ? m.mom : {};
  return Boolean(
    (mom.discussion ?? '').trim() ||
      (mom.decisions ?? '').trim() ||
      (mom.followUp ?? '').trim() ||
      m?.momDoc ||
      m?.momDocPath,
  );
}

export function dayKey(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toISOString().slice(0, 10);
}

export function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

// Spec §13 derived display status.
export function displayStatus(m) {
  const s = String(m?.status ?? '').toLowerCase();
  if (s === 'cancelled' || s === 'canceled') return 'Cancelled';
  if (s === 'held') return momRecorded(m) ? 'Completed' : 'Completed · MOM pending';
  const dk = dayKey(m?.date);
  const tk = todayKey();
  if (s === 'rescheduled') {
    if (dk && dk >= tk) return 'Rescheduled';
    return 'Awaiting update';
  }
  // Scheduled (or legacy states)
  if (dk && dk < tk) return 'Awaiting update';
  return 'Upcoming';
}

export function displayTone(s) {
  const v = String(s ?? '').toLowerCase();
  if (v === 'upcoming') return 'teal';
  if (v === 'rescheduled') return 'amber';
  if (v === 'awaiting update') return 'neutral';
  if (v === 'completed') return 'forest';
  if (v === 'completed · mom pending') return 'amber';
  if (v === 'cancelled') return 'rust';
  if (v === 'scheduled') return 'teal';
  return 'neutral';
}

export function isUpcoming(m) {
  const s = displayStatus(m);
  return s === 'Upcoming' || s === 'Rescheduled';
}

export function responseSummary(m) {
  if (String(m?.category ?? '') === 'Sudden') return { label: 'Ad-hoc', adHoc: true };
  const invites = m?.invites ?? [];
  let available = 0;
  let notAvailable = 0;
  let awaiting = 0;
  for (const v of invites) {
    if (v?.response === 'Available') available += 1;
    else if (v?.response === 'Not Available') notAvailable += 1;
    else awaiting += 1;
  }
  const parts = [];
  if (available) parts.push(`${available} available`);
  if (notAvailable) parts.push(`${notAvailable} not available`);
  if (awaiting) parts.push(`${awaiting} awaiting`);
  return {
    label: parts.join(' · ') || (invites.length === 0 ? '—' : 'Awaiting response'),
    available,
    notAvailable,
    awaiting,
    total: invites.length,
  };
}

export function attendanceSummary(m) {
  const rows = m?.attendance ?? [];
  if (rows.length === 0) {
    return {
      label: String(m?.status ?? '').toLowerCase() === 'held' ? 'Not marked' : '—',
      state: 'Not marked',
      attended: 0,
      total: m?.invites?.length ?? 0,
    };
  }
  const attended = rows.filter((x) => x.present).length;
  let state = 'Not marked';
  if (attended === rows.length) state = 'All attended';
  else if (attended < rows.length) state = 'Some absent';
  return { label: `${attended}/${rows.length} attended`, state, attended, total: rows.length };
}

export function actionState(a) {
  const s = String(a?.status ?? '');
  if (s === 'Open') return 'Pending';
  return s || 'Pending';
}

export function isOpenAction(a) {
  return ['Pending', 'Open', 'In Progress'].includes(actionState(a));
}

export function isOverdueAction(a) {
  if (!a?.due) return false;
  if (String(a.status ?? '') === 'Completed') return false;
  const d = new Date(a.due);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return d < now;
}

export function overdueDays(a) {
  if (!isOverdueAction(a)) return 0;
  const d = new Date(a.due);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.max(1, Math.ceil((now - d) / 86400000));
}

export function isDueSoonAction(a) {
  if (!a?.due) return false;
  if (String(a.status ?? '') === 'Completed') return false;
  if (isOverdueAction(a)) return false;
  const d = new Date(a.due);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const in3 = new Date(now);
  in3.setDate(now.getDate() + 3);
  return d >= now && d <= in3;
}

export function fmtDay(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtDateTime(m) {
  if (!m?.date) return '—';
  const date = fmtDay(m.date);
  const t = [m.startTime, m.endTime].filter(Boolean).join('–');
  return t ? `${date} ${t}` : date;
}

// Spec §15 alerts, derived client-side on every refresh.
export function computeAlerts(meetings) {
  const alerts = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const in7 = new Date(now);
  in7.setDate(now.getDate() + 7);
  const in2 = new Date(now);
  in2.setDate(now.getDate() + 2);
  const in14ago = new Date(now);
  in14ago.setDate(now.getDate() - 14);

  for (const m of meetings ?? []) {
    const id = idOf(m);
    const d = m?.date ? new Date(m.date) : null;
    const valid = d && !Number.isNaN(d.getTime());
    const ds = displayStatus(m);
    const upcoming = ds === 'Upcoming' || ds === 'Rescheduled';

    if (upcoming && valid && d >= now && d <= in7) {
      const diff = Math.ceil((d - now) / 86400000);
      const when = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : `In ${diff} days`;
      alerts.push({
        level: 'info',
        text: `${when}: ${m.type ?? ''} meeting${m.title ? ` — ${m.title}` : ''}`,
        meetingId: id,
      });
    }
    if (upcoming && String(m?.category ?? '') === 'Scheduled') {
      const rs = responseSummary(m);
      if (rs.notAvailable > 0) {
        alerts.push({
          level: 'attention',
          text: `${rs.notAvailable} not available: ${m.title ?? 'meeting'}`,
          meetingId: id,
        });
      }
      if (rs.awaiting > 0 && valid && d <= in2) {
        alerts.push({
          level: 'info',
          text: `${rs.awaiting} responses awaited: ${m.title ?? 'meeting'}`,
          meetingId: id,
        });
      }
    }
    if (String(m?.status ?? '').toLowerCase() === 'held' && !momRecorded(m)) {
      alerts.push({
        level: 'attention',
        text: `MOM pending: ${m.title ?? 'meeting'}${m.responsible ? ` (${m.responsible})` : ''}`,
        meetingId: id,
      });
    }
    for (const a of m?.actions ?? []) {
      if (String(a?.status ?? '') === 'Completed') continue;
      if (isOverdueAction(a)) {
        alerts.push({
          level: 'overdue',
          text: `Overdue ${overdueDays(a)}d: ${a.text ?? 'action'}`,
          meetingId: id,
          actionId: a._id ?? a.id,
        });
      } else if (isDueSoonAction(a)) {
        alerts.push({
          level: 'attention',
          text: `Due ${fmtDay(a.due)}: ${a.text ?? 'action'}`,
          meetingId: id,
          actionId: a._id ?? a.id,
        });
      }
    }
    const nm = m?.mom?.nextMeeting ? new Date(m.mom.nextMeeting) : null;
    if (nm && !Number.isNaN(nm.getTime()) && nm >= now && nm <= in7) {
      alerts.push({
        level: 'info',
        text: `Follow-up meeting due ${fmtDay(nm)}${m.title ? `: ${m.title}` : ''}`,
        meetingId: id,
      });
    }
    if (
      (String(m?.status ?? '').toLowerCase() === 'cancelled' ||
        String(m?.status ?? '').toLowerCase() === 'rescheduled') &&
      valid &&
      d >= in14ago &&
      d <= in7
    ) {
      const kind =
        String(m?.status ?? '').toLowerCase() === 'cancelled'
          ? `Cancelled${m.cancelReason ? `: ${m.cancelReason}` : ''}`
          : `Rescheduled to ${fmtDay(m.date)}`;
      alerts.push({ level: 'attention', text: `${kind}: ${m.title ?? ''}`, meetingId: id });
    }
  }
  const rank = { overdue: 0, attention: 1, info: 2 };
  return alerts.sort((a, b) => (rank[a.level] ?? 3) - (rank[b.level] ?? 3));
}

export function meetingMatchesActionFilter(m, f) {
  const actions = m?.actions ?? [];
  if (f === 'Has pending') return actions.some((a) => isOpenAction(a) && !isOverdueAction(a));
  if (f === 'Has overdue') return actions.some((a) => isOverdueAction(a));
  if (f === 'All completed') return actions.length > 0 && actions.every((a) => String(a.status) === 'Completed');
  if (f === 'No action items') return actions.length === 0;
  return true;
}

export function meetingMatchesAttendanceFilter(m, f) {
  const s = attendanceSummary(m);
  if (f === 'All attended') return s.state === 'All attended';
  if (f === 'Some absent') return s.state === 'Some absent';
  if (f === 'Not marked') return s.label === 'Not marked' || s.label === '—';
  return true;
}
