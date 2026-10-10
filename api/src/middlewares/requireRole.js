import {
  INTERNAL_ROLES,
  USER_ADMIN_ROLES,
  canAccess,
  isSuperRole,
} from '../config/roles.js';

// requireRole('hr', 'admin_billing', ...)
// Founding/Working Directors bypass every check (§3.4 full access).
export function requireRole(...allowed) {
  return (req, res, next) => {
    const role = req.user?.role;
    if (!role) {
      return res.status(401).json({ message: 'Not authenticated.' });
    }
    if (isSuperRole(role) || allowed.includes(role)) {
      return next();
    }
    return res
      .status(403)
      .json({ message: 'You do not have access to this area.' });
  };
}

// Any internal (non-client/architect) role. Superusers pass automatically.
export function requireInternal() {
  return requireRole(...INTERNAL_ROLES);
}

// Explicit deny-list evaluated before any allow (including the
// FD/WD superuser bypass): denied roles always get 403.
export function denyRoles(...denied) {
  return (req, res, next) => {
    if (denied.includes(req.user?.role)) {
      return res
        .status(403)
        .json({ message: 'You do not have access to this area.' });
    }
    return next();
  };
}

// Users who may provision logins: HR + Admin/Billing (+ superusers).
export function requireUserAdmin() {
  return requireRole(...USER_ADMIN_ROLES);
}

// Server-side page guard mirroring the client (§2.7). Use after requireAuth.
export function requireView(view) {
  return (req, res, next) => {
    const role = req.user?.role;
    if (!role) {
      return res.status(401).json({ message: 'Not authenticated.' });
    }
    if (!canAccess(role, view)) {
      return res
        .status(403)
        .json({ message: 'You do not have access to this area.' });
    }
    return next();
  };
}
