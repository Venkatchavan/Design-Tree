import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { useState } from 'react';
import { loginApi } from '../lib/api.js';
import { attendanceApi } from '../lib/api.js';
import Modal from '../components/Modal.jsx';

const SIDE_POINTS = [
  'Role-based access, from Founding Director to site QA/QC',
  'One workspace for design, coordination and delivery',
  'Live status across every project and discipline',
];

export default function LoginPage() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Late sign-in (after 9:45 IST): reason prompt before entering the app.
  const [lateOpen, setLateOpen] = useState(false);
  const [lateReason, setLateReason] = useState('');
  const [lateErr, setLateErr] = useState('');
  const [lateSaving, setLateSaving] = useState(false);

  function enterApp() {
    queryClient.invalidateQueries({ queryKey: ['me'] });
  }

  const login = useMutation({
    mutationFn: loginApi,
    onSuccess: (data) => {
      const att = data?.attendance;
      if (att?.late && !att?.reasonGiven && att?.workingDay !== false) {
        setLateOpen(true);
        return;
      }
      enterApp();
    },
  });

  async function saveLateReason() {
    if (!lateReason.trim()) {
      setLateErr('A reason is required for signing in after 9:45.');
      return;
    }
    setLateErr('');
    setLateSaving(true);
    try {
      await attendanceApi.reason({ lateReason: lateReason.trim() });
      setLateOpen(false);
      enterApp();
    } catch (e) {
      setLateErr(e?.message ?? 'Could not save the reason.');
    } finally {
      setLateSaving(false);
    }
  }

  function skipLateReason() {
    // Lets the user in; the reason stays pending and sign-out will
    // require it (enforced server-side).
    setLateOpen(false);
    enterApp();
  }

  const errorMsg = login.isError ? login.error.message : '';

  function handleSubmit(e) {
    e.preventDefault();
    if (login.isPending) return;
    login.mutate({ email: email.trim(), password });
  }

  return (
    <div className="login-screen">
      <div className="login-wrap">
        <div className="login-side">
          <div className="brand">
            <div className="brand-mark">D</div>
            <div className="brand-name">DesignTree</div>
          </div>
          <div className="login-tagline">
            Multi-disciplinary structural, MEP and design consultancy — project
            delivery, coordination and QA/QC in one workspace.
          </div>
          <div className="login-side-list">
            {SIDE_POINTS.map((point) => (
              <div className="login-side-item" key={point}>
                <Check className="icon" size={14} />
                {point}
              </div>
            ))}
          </div>
          <div className="login-side-foot">
            DesignTree Service Consultants Pvt. Ltd.
          </div>
        </div>
        <div className="login-main">
          <div className="login-title">Sign in to DesignTree</div>
          <div className="login-sub">
            Enter your work email and password to continue.
          </div>
          {login.isError && (
            <div
              className="login-error"
              role="alert"
              style={{ display: 'block' }}
            >
              {errorMsg}
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <div className="login-form-row">
              <label className="form-label" htmlFor="loginEmail">
                Work email
              </label>
              <input
                className="form-input"
                type="email"
                id="loginEmail"
                placeholder="you@datum.com"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="login-form-row">
              <label className="form-label" htmlFor="loginPassword">
                Password
              </label>
              <input
                className="form-input"
                type="password"
                id="loginPassword"
                placeholder="Password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="login-btn"
              disabled={login.isPending}
            >
              {login.isPending ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
      {lateOpen && (
        <Modal title="You signed in after 9:45" onClose={skipLateReason}>
          <p style={{ fontSize: 13.5, color: 'var(--ink-muted)', marginBottom: 8 }}>
            Late sign-in needs a reason. Add it now, or sign-out will ask for it later.
          </p>
          <div className="form-row">
            <label className="form-label">Reason for late sign-in *</label>
            <textarea
              className="form-input"
              value={lateReason}
              onChange={(e) => setLateReason(e.target.value)}
              placeholder="e.g. Train delayed, client visit ran over"
            />
          </div>
          {lateErr && (
            <div className="login-error" role="alert" style={{ display: 'block' }}>
              {lateErr}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
            <button type="button" className="btn-primary" disabled={lateSaving} onClick={saveLateReason}>
              {lateSaving ? 'Saving…' : 'Save reason & continue'}
            </button>
            <button type="button" className="approve-btn" onClick={skipLateReason}>
              Skip for now
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
