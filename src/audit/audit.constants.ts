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
  'coupon.created',
  'coupon.updated',
  'coupon.deleted',
  'campaign.created',
  'campaign.updated',
  'campaign.deleted',
  'auth.password_changed',
  'auth.account_locked',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_AREAS = ['user', 'role', 'settings', 'coupon', 'campaign', 'auth'] as const;
export type AuditArea = (typeof AUDIT_AREAS)[number];

/** Keep three months of history unless AUDIT_LOG_RETENTION_DAYS says otherwise. */
export const DEFAULT_AUDIT_RETENTION_DAYS = 90;

/** Rows deleted per statement — small enough to never hold long locks. */
export const AUDIT_PURGE_BATCH_SIZE = 5_000;

/** Redis lock so only one app instance runs the nightly purge. */
export const AUDIT_PURGE_LOCK_KEY = 'lock:audit-log-purge';
export const AUDIT_PURGE_LOCK_TTL_SECONDS = 15 * 60;
