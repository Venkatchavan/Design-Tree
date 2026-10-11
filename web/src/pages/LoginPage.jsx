import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Building2, Check, ScanLine } from 'lucide-react';
import { useState } from 'react';
import { loginApi } from '../lib/api.js';
import { attendanceApi } from '../lib/api.js';
import Modal from '../components/Modal.jsx';

const SIDE_POINTS = [
  'Role-based access, from Founding Director to site QA/QC',
  'One workspace for design, coordination and delivery',
  'Live status across every project and discipline',
];

const SCAN_ROLES = [
  { name: 'Structural', label: 'Design lead', initials: 'ST', tone: 'structural' },
  { name: 'MEP', label: 'Services team', initials: 'ME', tone: 'mep' },
  { name: 'Site QA/QC', label: 'Quality control', initials: 'QA', tone: 'qaqc' },
];

function LoginScanner() {
  return (
    <div className="login-scanner-layout">
      <div className="login-scanner-stage" aria-hidden="true">
        <svg className="login-scanner-svg" viewBox="0 0 620 380" focusable="false">
          <defs>
            <linearGradient id="login-floor" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#91B5FF" stopOpacity=".12" />
              <stop offset="1" stopColor="#91B5FF" stopOpacity=".015" />
            </linearGradient>
            <linearGradient id="login-gate-top" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#7195EC" />
              <stop offset="1" stopColor="#3B5DAF" />
            </linearGradient>
            <linearGradient id="login-gate-front" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#3B5CA8" />
              <stop offset="1" stopColor="#243E7D" />
            </linearGradient>
            <linearGradient id="login-gate-side" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#253D78" />
              <stop offset="1" stopColor="#172B5B" />
            </linearGradient>
            <linearGradient id="login-belt-top" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#273E78" />
              <stop offset="1" stopColor="#142857" />
            </linearGradient>
            <linearGradient id="login-belt-front" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#20386D" />
              <stop offset="1" stopColor="#14264E" />
            </linearGradient>
            <radialGradient id="login-floor-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0" stopColor="#5B9BF0" stopOpacity=".24" />
              <stop offset="1" stopColor="#5B9BF0" stopOpacity="0" />
            </radialGradient>
            <filter id="login-gate-shadow" x="-30%" y="-30%" width="160%" height="180%">
              <feGaussianBlur stdDeviation="9" />
            </filter>
          </defs>

          <ellipse cx="319" cy="303" rx="246" ry="56" fill="url(#login-floor-glow)" />
          <path
            d="M25 206 324 48 598 184 299 342Z"
            fill="url(#login-floor)"
            stroke="rgba(190,211,255,.14)"
            strokeWidth="1"
          />
          <path d="m76 206 298 157M127 180l298 157M179 153l298 157M230 126l298 157M281 99l298 157" stroke="rgba(190,211,255,.08)" strokeWidth="1" />
          <path d="m126 260 299-158M178 286l299-158M229 313l299-158M281 339l299-158" stroke="rgba(190,211,255,.08)" strokeWidth="1" />

          <path d="m191 284 173-93 123 61-174 93Z" fill="#081735" opacity=".58" filter="url(#login-gate-shadow)" />

          <g strokeLinejoin="round">
            <path d="M197 139 365 139 396 122 228 122Z" fill="url(#login-gate-top)" stroke="rgba(198,216,255,.62)" />
            <path d="M197 139h168v31H197Z" fill="url(#login-gate-front)" stroke="rgba(198,216,255,.4)" />
            <path d="m365 139 31-17v30l-31 18Z" fill="url(#login-gate-side)" stroke="rgba(198,216,255,.28)" />
            <path d="M197 139h34v145h-34Z" fill="#34559F" stroke="rgba(198,216,255,.44)" />
            <path d="m231 139 17-9v137l-17 17Z" fill="#233D79" stroke="rgba(198,216,255,.24)" />
            <path d="M331 139h34v145h-34Z" fill="#2C4A91" stroke="rgba(198,216,255,.38)" />
            <path d="m365 139 31-17v132l-31 30Z" fill="#20396F" stroke="rgba(198,216,255,.24)" />
            <path d="M231 170h100v112H231Z" fill="#0D1B3D" stroke="rgba(120,166,255,.52)" />
            <path d="M238 177h86v104h-86Z" fill="#101F45" />
            <path d="M248 180v95" stroke="rgba(255,255,255,.08)" strokeWidth="1" />
            <path d="M320 180v95" stroke="rgba(255,255,255,.08)" strokeWidth="1" />
            <path d="M238 178h86" stroke="rgba(127,179,255,.66)" strokeWidth="2" />
            <circle cx="342" cy="153" r="3.2" fill="#8BB7FF" />
            <circle cx="353" cy="153" r="3.2" fill="#6EE2C1" />
            <path d="M209 153h9M209 159h9" stroke="rgba(232,241,255,.48)" strokeWidth="1.2" strokeLinecap="round" />
          </g>

          <g strokeLinejoin="round">
            <path d="m45 267 469-24 72 39-470 27Z" fill="url(#login-belt-top)" stroke="rgba(155,187,255,.56)" />
            <path d="m116 309 470-27v29l-470 28Z" fill="url(#login-belt-front)" stroke="rgba(155,187,255,.36)" />
            <path d="m45 267 71 42v30l-71-42Z" fill="#182D5A" stroke="rgba(155,187,255,.3)" />
            <path d="m60 273 462-23" stroke="rgba(141,179,255,.25)" strokeWidth="1" />
            <path d="m124 316 451-26" stroke="rgba(141,179,255,.22)" strokeWidth="1" />
            <path d="m140 348 450-27" stroke="rgba(5,17,43,.62)" strokeWidth="2" />
            <path d="m174 328-1 30M236 324l1 30M299 320l2 30M362 316l3 30M425 313l4 29M488 309l5 29M547 305l5 29" stroke="rgba(140,170,228,.26)" strokeWidth="2" />
            <path d="m139 351 3 14M557 327l4 15M223 343l2 14M470 329l3 14" stroke="#111F42" strokeWidth="5" strokeLinecap="round" />
          </g>

          <g fill="#90B5FF" opacity=".42">
            <circle cx="64" cy="111" r="2" />
            <circle cx="554" cy="87" r="2" />
            <circle cx="579" cy="100" r="1.5" />
          </g>
          <path d="M48 124h68M48 130h33M520 106h48M542 112h26" stroke="rgba(180,205,255,.23)" strokeWidth="1" />
        </svg>

        <div className="login-scan-beam" />
        {SCAN_ROLES.map((role) => (
          <div className={`login-role login-role--${role.tone}`} key={role.tone}>
            <span className="login-role-mark">{role.initials}</span>
            <span className="login-role-copy">
              <strong>{role.name}</strong>
              <small>{role.label}</small>
            </span>
            <span className="login-role-light" />
          </div>
        ))}
      </div>

      <div className="login-civil-readout">
        <div className="login-readout-heading">
          <span className="login-readout-icon" aria-hidden="true">
            <Building2 size={15} strokeWidth={1.8} />
          </span>
          <span className="login-readout-label">Project snapshot</span>
        </div>
        <div className="login-readout-title-row">
          <div>
            <span className="login-readout-caption">Civil works</span>
            <strong className="login-readout-percent">68<span>%</span></strong>
          </div>
          <span className="login-readout-status">
            <span /> In progress
          </span>
        </div>
        <div
          className="login-readout-track"
          role="img"
          aria-label="Illustrative civil works progress: 68 percent"
        >
          <span />
        </div>
        <div className="login-readout-stages">
          <span><i /> Structure <b>On track</b></span>
          <span><i /> MEP <b>In coordination</b></span>
        </div>
        <span className="login-readout-note">Illustrative project preview</span>
      </div>
    </div>
  );
}

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
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />
                  )}
                </button>
              </div>
            </form>
          </div>
        </section>

        <aside className="login-side" aria-label="About DesignTree">
          <div className="login-brand">
            <div className="login-brand-mark" aria-hidden="true">D</div>
            <div className="login-brand-name">DesignTree</div>
          </div>

          <div className="login-side-intro">
            <span className="login-side-kicker">Project delivery, in sync</span>
            <h2>From design desk<br />to site floor.</h2>
            <p className="login-tagline">
              Structural, MEP and design teams—coordinating delivery and QA/QC
              in one workspace.
            </p>
          </div>

          <div className="login-visual-heading" aria-hidden="true">
            <span>One project. Every discipline.</span>
            <span>01 — 03</span>
          </div>
          <LoginScanner />

          <div className="login-side-list">
            {SIDE_POINTS.map((point) => (
              <div className="login-side-item" key={point}>
                <Check className="icon" size={14} aria-hidden="true" />
                <span>{point}</span>
              </div>
            ))}
          </div>
          <div className="login-side-foot">
            DesignTree Service Consultants Pvt. Ltd.
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
