import { logoutApi } from './api.js';

export const PENDING_LOGOUT_KEY = 'datum-pending-logout';
export const SUPER_ROLES = ['founding_director', 'working_director'];

// Directive roles (founding director → assoc technical director): no own
// man-hour entry required, sign out directly, view-only for others' hours.
export const DIRECTIVE_ROLES = [
  'founding_director',
  'working_director',
  'admin_billing',
  'hr',
  'executive_director',
  'associate_director',
  'technical_director',
  'assoc_technical_director',
];

export function isDirectiveRole(role) {
  return DIRECTIVE_ROLES.includes(role);
}

// Set when sign-out is deferred until today's man-hours are recorded (§2.6).
export function setPendingLogout() {
  try {
    localStorage.setItem(PENDING_LOGOUT_KEY, '1');
  } catch {
    /* storage unavailable */
  }
}

export function isPendingLogout() {
  try {
    return localStorage.getItem(PENDING_LOGOUT_KEY) === '1';
  } catch {
    return false;
  }
}

export function takePendingLogout() {
  const was = isPendingLogout();
  try {
    localStorage.removeItem(PENDING_LOGOUT_KEY);
  } catch {
    /* storage unavailable */
  }
  return was;
}

export function entryPathForRole(role) {
  if (role === 'engineer_drafter') return '/my-work';
  if (role === 'coordinator') return '/my-coordination';
  return '/work/update';
}

export async function performLogout(queryClient) {
  try {
    await logoutApi();
  } catch {
    /* already logged out server-side */
  }
  queryClient.setQueryData(['me'], null);
  queryClient.removeQueries({ queryKey: ['bootstrap'] });
}
