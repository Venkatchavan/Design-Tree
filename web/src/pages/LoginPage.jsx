import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Check, ScanLine } from 'lucide-react';
import { useRef, useState } from 'react';
import { loginApi } from '../lib/api.js';
import { attendanceApi } from '../lib/api.js';
import Modal from '../components/Modal.jsx';
import BrandLogo from '../components/BrandLogo.jsx';
import LoginScene from './LoginScene.jsx';

const SIDE_POINTS = [
  'Role-based access, from Founding Director to site QA/QC',
  'One workspace for design, coordination and delivery',
  'Live status across every project and discipline',
];

const DISCIPLINES = [
  { code: 'ST', name: 'Structural', value: 72, status: 'On track', tone: 'structural' },
  { code: 'ME', name: 'MEP', value: 58, status: 'Coordinating', tone: 'mep' },
  { code: 'QA', name: 'QA/QC', value: 34, status: 'Inspecting', tone: 'qaqc' },
];

export default function LoginPage() {
  const queryClient = useQueryClient();
  const sideRef = useRef(null);
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

  // Cursor-follow spotlight on the showcase panel (sets CSS vars, no re-render).
  function handleSideMove(e) {
    const el = sideRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - rect.left}px`);
    el.style.setProperty('--my', `${e.clientY - rect.top}px`);
  }

  const errorMsg = login.isError ? login.error.message : '';

  function handleSubmit(e) {
    e.preventDefault();
    if (login.isPending) return;
    login.mutate({ email: email.trim(), password });
  }

  return (
    <div className="login-screen">
      <main className="login-wrap">
        <section className="login-main" aria-labelledby="login-title">
          <div className="login-form-panel">
            <div className="login-form-kicker">
              <ScanLine size={15} strokeWidth={1.8} aria-hidden="true" />
              DesignTree workspace
            </div>
            <h1 className="login-title" id="login-title">Welcome back</h1>
            <p className="login-sub">
              Sign in with your work account to continue.
            </p>
            {login.isError && (
              <div
                className="login-error"
                id="login-error"
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
              <div className="login-button-frame">
                <button
                  type="submit"
                  className="login-btn"
                  disabled={login.isPending}
                  aria-busy={login.isPending}
                  aria-describedby={login.isError ? 'login-error' : undefined}
                >
                  <span>{login.isPending ? 'Signing in…' : 'Sign in'}</span>
                  {login.isPending ? (
                    <span className="login-button-spinner" aria-hidden="true" />
                  ) : (
                    <ArrowRight
                      className="login-button-arrow"
                      size={17}
                      strokeWidth={1.9}
                      aria-hidden="true"
                    />
                  )}
                </button>
              </div>
            </form>
          </div>
        </section>

        <aside
          className="login-side"
          ref={sideRef}
          onPointerMove={handleSideMove}
          aria-label="About DesignTree"
        >
          <div className="login-cursor-glow" aria-hidden="true" />

          <div className="login-brand">
            <BrandLogo className="login-logo" />
          </div>

          <div className="login-side-intro">
            <span className="login-side-kicker">
              <i aria-hidden="true" />
              Project delivery, in sync
            </span>
            <h2>
              From design desk
              <br />
              <span>to site floor.</span>
            </h2>
            <p className="login-tagline">
              Structural, MEP and design teams—coordinating delivery and QA/QC
              in one workspace.
            </p>
          </div>

          <div className="login-scene">
            <div className="login-scene-head" aria-hidden="true">
              <span>One project · Every discipline</span>
              <span>01 — 03</span>
            </div>
            <LoginScene />
            <div className="login-readout" role="group" aria-label="Illustrative project snapshot">
              {DISCIPLINES.map((d) => (
                <div className={`login-readout-cell tone-${d.tone}`} key={d.code}>
                  <div className="login-readout-top">
                    <span className="login-readout-code">{d.code}</span>
                    <span className="login-readout-status">
                      <i aria-hidden="true" />
                      {d.status}
                    </span>
                  </div>
                  <div className="login-readout-value">
                    {d.value}
                    <span>%</span>
                  </div>
                  <div
                    className="login-readout-track"
                    role="img"
                    aria-label={`${d.name} progress: ${d.value} percent (illustrative)`}
                  >
                    <span style={{ '--w': `${d.value}%` }} />
                  </div>
                  <div className="login-readout-name">{d.name}</div>
                </div>
              ))}
            </div>
            <span className="login-note">Illustrative project preview</span>
          </div>

          <div className="login-side-list">
            {SIDE_POINTS.map((point) => (
              <div className="login-side-item" key={point}>
                <span className="login-side-check" aria-hidden="true">
                  <Check size={11} strokeWidth={2.4} />
                </span>
                <span>{point}</span>
              </div>
            ))}
          </div>
          <div className="login-side-foot">
            <span>DesignTree Service Consultants Pvt. Ltd.</span>
          </div>
        </aside>
      </main>
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