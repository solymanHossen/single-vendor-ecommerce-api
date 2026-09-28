/** Every audited action. Prefix = area, used for filtering in the admin UI. */
export const AUDIT_ACTIONS = [
  'user.deactivated',
  'user.reactivated',
  'user.unlocked',
  'user.sessions_revoked',
  'user.session_revoked',
  'user.access_changed',
  'role.created',
  'role.updated',
  'role.deleted',
  'settings.updated',
  'auth.password_changed',
  'auth.account_locked',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_AREAS = ['user', 'role', 'settings', 'auth'] as const;
export type AuditArea = (typeof AUDIT_AREAS)[number];
