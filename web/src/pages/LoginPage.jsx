import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { useState } from 'react';
import { loginApi } from '../lib/api.js';

const SIDE_POINTS = [
  'Role-based access, from Founding Director to site QA/QC',
  'One workspace for design, coordination and delivery',
  'Live status across every project and discipline',
];

export default function LoginPage() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const login = useMutation({
    mutationFn: loginApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });

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
    </div>
  );
}
