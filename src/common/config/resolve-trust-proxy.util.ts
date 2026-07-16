/** The shape Express's `app.set('trust proxy', value)` accepts. */
export type TrustProxySetting = boolean | number | string;

/**
 * Translates the string-only `TRUST_PROXY` env var into the value Express's
 * `trust proxy` setting expects. Kept as a pure function so the parsing rules
 * are unit-testable without booting the HTTP server.
 */
export function resolveTrustProxy(rawValue: string): TrustProxySetting {
  const normalized = rawValue.trim();

  if (normalized.length === 0 || normalized.toLowerCase() === 'false') {
    return false;
  }

  if (normalized.toLowerCase() === 'true') {
    return true;
  }

  if (/^\d+$/.test(normalized)) {
    return Number.parseInt(normalized, 10);
  }

  // Comma-separated subnet/keyword list (e.g. 'loopback, 10.0.0.0/8') —
  // Express parses this format natively.
  return normalized;
}
