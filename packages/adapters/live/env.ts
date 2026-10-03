// Settings and helpers for the checks against the running stack.
import { existsSync } from 'node:fs';
import https from 'node:https';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '../../..');

// `.env` first, then `.env.example` fills the rest, as `pnpm stack` reads them.
for (const file of ['.env', '.env.example']) {
  const full = path.join(repoRoot, file);
  if (existsSync(full)) process.loadEnvFile(full);
}

export function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. See .env.example.`);
  return value;
}

export interface StackResponse {
  status: number;
  body: string;
}

/**
 * An HTTPS request to one of the stack's `*.localhost` sites. Node.js on Windows can't resolve
 * those names, so the lookup goes to the loopback address. These checks are about the adapters,
 * not the certificate, which `pnpm stack:check` covers.
 */
export function stackRequest(
  url: string,
  options: { method?: string; headers?: Record<string, string>; body?: string } = {},
): Promise<StackResponse> {
  return new Promise((resolve, reject) => {
    const request = https.request(
      url,
      {
        method: options.method ?? 'GET',
        headers: options.headers,
        rejectUnauthorized: false,
        lookup: (_hostname, lookupOptions, callback) => {
          if (lookupOptions.all) callback(null, [{ address: '127.0.0.1', family: 4 }]);
          else callback(null, '127.0.0.1', 4);
        },
      },
      (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk: string) => (body += chunk));
        response.on('end', () => {
          resolve({ status: response.statusCode ?? 0, body });
        });
      },
    );
    request.on('error', reject);
    request.end(options.body);
  });
}

/** GETs JSON from Mailpit's API at https://mail.chaku.localhost. */
export async function mailpit<T>(apiPath: string): Promise<T> {
  const response = await stackRequest(`https://mail.chaku.localhost${apiPath}`);
  if (response.status !== 200) throw new Error(`Mailpit ${apiPath}: ${String(response.status)}`);
  return JSON.parse(response.body) as T;
}
