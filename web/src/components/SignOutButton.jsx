import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { attendanceApi } from '../lib/api.js';
import { spocApi } from '../lib/spocApi.js';
import {
  entryPathForRole,
  isAttendanceExemptRole,
  isManHourExemptRole,
  performLogout,
  setPendingLogout,
} from '../lib/session.js';
import Modal from './Modal.jsx';

export const MAN_HOUR_NOTE = 'Man-hour entry is mandatory before you sign out.';

export default function SignOutButton({ user, roleKey, className = 'nav-item' }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [err, setErr] = useState('');
  // Attendance reason gate (late sign-in after 9:45 / early sign-out).
  const [attendOpen, setAttendOpen] = useState(false);
  const [needLate, setNeedLate] = useState(false);
  const [needEarly, setNeedEarly] = useState(false);
  const [lateReason, setLateReason] = useState('');
  const [earlyReason, setEarlyReason] = useState('');
  const [attendErr, setAttendErr] = useState('');
  const [attendInfo, setAttendInfo] = useState(null);

  async function doLogout(reasons) {
    const res = await performLogout(queryClient, reasons);
    if (res?.ok === false) {
      // Server held the session open: a reason is still missing.
      const code = res.error?.data?.code;
      setNeedLate(code === 'LATE_REASON_REQUIRED' ? true : needLate);
      if (code === 'EARLY_LOGOUT_REASON_REQUIRED') {
        setNeedEarly(true);
        setAttendInfo({ durationHours: res.error?.data?.durationHours });
      }
      setAttendErr(res.error?.message ?? 'A reason is required to sign out.');
      setAttendOpen(true);
      return;
    }
    navigate('/');
  }

  // Attendance gate after the man-hour gate: late sign-in (9:45 IST) and
  // early sign-out (under 8 hours) each need a reason. Exempt roles and
  // non-working days (Sunday / Holiday) skip it entirely.
  async function checkAttendance() {
    if (isAttendanceExemptRole(roleKey)) {
      await doLogout();
      return;
    }
    let s;
    try {
      s = await attendanceApi.status();
    } catch {
      // Status unavailable: fail open — the server still enforces reasons.
      await doLogout();
      return;
    }
    if (!s?.required) {
      await doLogout();
      return;
    }
    const late = !!s.late;
    const early = !!s.underHours;
    if (!late && !early) {
      await doLogout();
      return;
    }
    setNeedLate(late);
    setNeedEarly(early);
    setAttendInfo({ durationHours: s.durationHours });
    setAttendErr('');
    setAttendOpen(true);
  }

  async function saveAttendAndLogout() {
    if (needLate && !lateReason.trim()) {
      setAttendErr('A reason is required for signing in after 9:45.');
      return;
    }
    if (needEarly && !earlyReason.trim()) {
      setAttendErr('A reason is required for signing out before 8 hours.');
      return;
    }
    setAttendErr('');
    setAttendOpen(false);
    await doLogout({
      ...(needLate ? { lateReason: lateReason.trim() } : {}),
      ...(needEarly ? { earlyLogoutReason: earlyReason.trim() } : {}),
    });
  }

  async function handleClick() {
    // Exempt roles (directive + external + superuser): no own man-hour entry, sign out directly.
    if (isManHourExemptRole(roleKey)) {
      await doLogout();
      return;
    }
    setErr('');
    setChecking(true);
    try {
      const s = await spocApi.manHourStatus();
      if (!s?.required || s?.logged) {
        await checkAttendance();
        return;
      }
      setOpen(true);
    } catch (e) {
      // Status endpoint unavailable: fail open to the confirm dialog so the
      // user can still choose, rather than blocking sign-out entirely.
      setOpen(true);
      setErr(e?.message ?? 'Could not verify man-hour status.');
    } finally {
      setChecking(false);
    }
  }

  function goToEntry() {
    setPendingLogout();
    setOpen(false);
    navigate(entryPathForRole(roleKey));
  }

  return (
    <>
      <button
        type="button"
        className={className}
        style={{ width: 'auto', padding: 8 }}
        title={user?.name ? `Sign out (${user.name})` : 'Sign out'}
        onClick={handleClick}
        disabled={checking}
        aria-label={user?.name ? `Sign out (${user.name})` : 'Sign out'}
      >
        <LogOut size={17} />
      </button>
      {open && (
        <Modal title="Have you entered your man-hours today?" onClose={() => setOpen(false)}>
          <p style={{ fontSize: 13.5, color: 'var(--ink-muted)', marginBottom: 8 }}>
            Your daily man-hour entry keeps project tracking accurate. {MAN_HOUR_NOTE}
          </p>
          {err && (
            <div className="login-error" role="alert" style={{ display: 'block' }}>
              {err}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
            <button type="button" className="btn-primary" onClick={() => { setOpen(false); checkAttendance(); }}>
              Yes, sign out
            </button>
            <button type="button" className="approve-btn" onClick={goToEntry}>
              No, take me to entry
            </button>
          </div>
        </Modal>
      )}
      {attendOpen && (
        <Modal title="A reason is needed to sign out" onClose={() => setAttendOpen(false)}>
          <p style={{ fontSize: 13.5, color: 'var(--ink-muted)', marginBottom: 8 }}>
            {needLate && needEarly
              ? `You signed in after 9:45 and have worked ${attendInfo?.durationHours ?? 'under 8'} hours — both need a reason.`
              : needLate
                ? 'You signed in after 9:45 — a reason is required.'
                : `You have worked ${attendInfo?.durationHours ?? 'under 8'} hours — signing out before 8 hours needs a reason.`}
          </p>
          {needLate && (
            <div className="form-row">
              <label className="form-label">Reason for late sign-in *</label>
              <textarea
                className="form-input"
                value={lateReason}
                onChange={(e) => setLateReason(e.target.value)}
                placeholder="e.g. Train delayed, client visit ran over"
              />
            </div>
          )}
          {needEarly && (
            <div className="form-row">
              <label className="form-label">Reason for early sign-out *</label>
              <textarea
                className="form-input"
                value={earlyReason}
                onChange={(e) => setEarlyReason(e.target.value)}
                placeholder="e.g. Doctor appointment, half-day approved"
              />
            </div>
          )}
          {attendErr && (
            <div className="login-error" role="alert" style={{ display: 'block' }}>
              {attendErr}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
            <button type="button" className="btn-primary" onClick={saveAttendAndLogout}>
              Save reason & sign out
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
