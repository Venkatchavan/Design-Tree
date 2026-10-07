import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { spocApi } from '../lib/spocApi.js';
import {
  SUPER_ROLES,
  entryPathForRole,
  performLogout,
  setPendingLogout,
} from '../lib/session.js';
import Modal from './Modal.jsx';

export const MAN_HOUR_NOTE = 'Man-hour entry is mandatory before you sign out.';

export default function SignOutButton({ user, roleKey }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [err, setErr] = useState('');

  async function doLogout() {
    await performLogout(queryClient);
    navigate('/');
  }

  async function handleClick() {
    setErr('');
    setChecking(true);
    try {
      const s = await spocApi.manHourStatus();
      if (!s?.required || s?.logged) {
        await doLogout();
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

  const isSuper = SUPER_ROLES.includes(roleKey);

  return (
    <>
      <button
        type="button"
        className="nav-item"
        style={{ width: 'auto', padding: 8 }}
        title={user?.name ? `Sign out (${user.name})` : 'Sign out'}
        onClick={handleClick}
        disabled={checking}
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
            <button type="button" className="btn-primary" onClick={doLogout}>
              Yes, sign out
            </button>
            <button type="button" className="approve-btn" onClick={goToEntry}>
              No, take me to entry
            </button>
            {isSuper && (
              <button type="button" className="approve-btn" onClick={doLogout}>
                Sign out anyway (override)
              </button>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
