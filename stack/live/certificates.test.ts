// CHK-14: every site, Mailpit's included, is served over HTTPS with a certificate that a browser
// trusts once Caddy's root is trusted (ADR-0006). The checks trust only that root.
import { readFileSync } from 'node:fs';
import tls from 'node:tls';

import { beforeAll, describe, expect, it } from 'vitest';

import { loadEnv, readRootCertificate, rootCertificateFile, sites } from '../src/stack.ts';
import { request } from './https.ts';

loadEnv();

let root = '';
beforeAll(() => {
  root = readRootCertificate();
});

describe('HTTPS on the .localhost sites', () => {
  it('exports the root that Caddy signs with, for the trust step', () => {
    expect(readFileSync(rootCertificateFile, 'utf8')).toBe(root);
  });

  it('opens Mailpit at https://mail.chaku.localhost with a trusted certificate', async () => {
    const response = await request(`https://${sites.mail}/`, { ca: root });
    expect(response.status).toBe(200);
    expect(response.body).toContain('Mailpit');
    expect(response.certificateNames).toEqual([sites.mail]);
  });

  it.each(Object.values(sites))('serves %s with a certificate for that name', async (site) => {
    const response = await request(`https://${site}/`, { ca: root });
    expect(response.certificateNames).toEqual([site]);
    expect(response.status).toBeGreaterThanOrEqual(200);
  });

  it('answers 502 with a hint while an app is not running', async () => {
    const response = await request(`https://${sites.referenceGame}/`, { ca: root });
    expect(response.status).toBe(502);
    expect(response.body).toMatch(/not running.*pnpm dev/);
  });

  it('is not trusted before the trust step', async () => {
    await expect(request(`https://${sites.mail}/`)).rejects.toMatchObject({
      code: expect.stringMatching(/CERT|SELF_SIGNED|UNABLE_TO_VERIFY/) as unknown,
    });
  });

  // CHK-39: after the trust step, NODE_USE_SYSTEM_CA or NODE_EXTRA_CA_CERTS put Caddy's root into
  // Node's default list. The check above must still see only the public roots.
  it('is not trusted before the trust step when Node already trusts Caddy', async () => {
    const defaults = tls.getCACertificates('default');
    tls.setDefaultCACertificates([...defaults, root]);
    try {
      await expect(request(`https://${sites.mail}/`)).rejects.toMatchObject({
        code: expect.stringMatching(/CERT|SELF_SIGNED|UNABLE_TO_VERIFY/) as unknown,
      });
    } finally {
      tls.setDefaultCACertificates(defaults);
    }
  });
});
