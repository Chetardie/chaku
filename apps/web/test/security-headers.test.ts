// CHK-19: HSTS, nosniff, Referrer-Policy and a Permissions-Policy on every response (D9).
import { describe, expect, it } from 'vitest';

import { securityHeaders } from '../src/server/security-headers.ts';

const header = (name: string) => securityHeaders.find((entry) => entry.key === name)?.value;

describe('security headers', () => {
  it('keeps browsers on HTTPS for at least a year, subdomains included', () => {
    const hsts = header('Strict-Transport-Security') ?? '';
    expect(Number(/max-age=(\d+)/.exec(hsts)?.[1])).toBeGreaterThanOrEqual(31_536_000);
    expect(hsts).toContain('includeSubDomains');
  });

  it('stops content type sniffing', () => {
    expect(header('X-Content-Type-Options')).toBe('nosniff');
  });

  it('sends only the origin to other sites', () => {
    expect(header('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  });

  it('turns off browser features Chaku does not use', () => {
    const policy = header('Permissions-Policy') ?? '';
    for (const feature of ['camera', 'microphone', 'geolocation', 'payment', 'usb']) {
      expect(policy).toContain(`${feature}=()`);
    }
  });

  it('leaves fullscreen alone for Games (spec §5.4)', () => {
    expect(header('Permissions-Policy')).not.toContain('fullscreen');
  });

  it('refuses to be framed', () => {
    expect(header('X-Frame-Options')).toBe('DENY');
  });
});
