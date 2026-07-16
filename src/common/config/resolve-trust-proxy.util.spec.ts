import { resolveTrustProxy } from './resolve-trust-proxy.util';

describe('resolveTrustProxy', () => {
  it('returns false for the string "false"', () => {
    expect(resolveTrustProxy('false')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(resolveTrustProxy('')).toBe(false);
  });

  it('returns true for the string "true"', () => {
    expect(resolveTrustProxy('true')).toBe(true);
  });

  it('is case-insensitive for boolean keywords', () => {
    expect(resolveTrustProxy('TRUE')).toBe(true);
    expect(resolveTrustProxy('False')).toBe(false);
  });

  it('parses a positive integer hop count as a number', () => {
    expect(resolveTrustProxy('1')).toBe(1);
    expect(resolveTrustProxy('3')).toBe(3);
  });

  it('passes through a subnet/keyword list verbatim', () => {
    expect(resolveTrustProxy('loopback, 10.0.0.0/8')).toBe('loopback, 10.0.0.0/8');
  });

  it('trims surrounding whitespace before evaluating', () => {
    expect(resolveTrustProxy('  2  ')).toBe(2);
    expect(resolveTrustProxy('  true  ')).toBe(true);
  });
});
