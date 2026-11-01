import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CircleAlert, Eye, EyeOff, Lock, Mail, ScanLine } from 'lucide-react';
import { useState } from 'react';
import { loginApi } from '../lib/api.js';
import { attendanceApi } from '../lib/api.js';
import Modal from '../components/Modal.jsx';
import BrandLogo from '../components/BrandLogo.jsx';
import LoginScene from './LoginScene.jsx';

export default function LoginPage() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
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

  // Browsers expose Caps Lock state on key events (not on focus), so we read it here.
  function trackCaps(e) {
    if (typeof e.getModifierState === 'function') {
      setCapsOn(e.getModifierState('CapsLock'));
    }
  }

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
            {login.isError ? (
              <div className="login-error" id="login-error" role="alert" style={{ display: 'flex' }}>
                <CircleAlert size={16} strokeWidth={1.9} aria-hidden="true" />
                <span>{errorMsg}</span>
              </div>
            ) : (
              <p className="login-sub">Sign in with your work account to continue.</p>
            )}
            <form onSubmit={handleSubmit}>
              <div className="login-form-row">
                <label className="form-label" htmlFor="loginEmail">
                  Work email
                </label>
                <div className="login-field">
                  <Mail className="login-field-icon" size={16} strokeWidth={1.8} aria-hidden="true" />
                  <input
                    className="form-input"
                    type="email"
                    id="loginEmail"
                    placeholder="you@designtreeconsultants.com"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    autoFocus
                    required
                    value={email}
                    aria-invalid={login.isError || undefined}
                    aria-describedby={login.isError ? 'login-error' : undefined}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (login.isError) login.reset();
                    }}
                  />
                </div>
              </div>
              <div className="login-form-row">
                <label className="form-label" htmlFor="loginPassword">
                  Password
                </label>
                <div className="login-field">
                  <Lock className="login-field-icon" size={16} strokeWidth={1.8} aria-hidden="true" />
                  <input
                    className="form-input has-toggle"
                    type={showPassword ? 'text' : 'password'}
                    id="loginPassword"
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                    value={password}
                    aria-invalid={login.isError || undefined}
                    aria-describedby={
                      [login.isError && 'login-error', capsOn && 'login-caps']
                        .filter(Boolean)
                        .join(' ') || undefined
                    }
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (login.isError) login.reset();
                    }}
                    onKeyDown={trackCaps}
                    onKeyUp={trackCaps}
                    onBlur={() => setCapsOn(false)}
                  />
                  <button
                    type="button"
                    className="login-reveal"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? (
                      <EyeOff size={17} strokeWidth={1.8} aria-hidden="true" />
                    ) : (
                      <Eye size={17} strokeWidth={1.8} aria-hidden="true" />
                    )}
                  </button>
                </div>
                {capsOn && (
                  <p className="login-caps" id="login-caps" role="status">
                    Caps Lock is on.
                  </p>
                )}
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
            <p className="login-help">
              Forgot your password? Ask HR or your administrator to reset it.
            </p>
            <p className="login-help login-help--note">
              Sign-ins are recorded for attendance. A sign-in after 9:45 needs
              a reason.
            </p>
          </div>
        </section>

        <aside className="login-side" aria-label="About DesignTree">
          <div className="login-brand">
            <BrandLogo className="login-logo" />
          </div>

          <div className="login-side-intro">
            <h2>From design desk to site floor.</h2>
          </div>

          <div className="login-scene">
            <LoginScene />
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
