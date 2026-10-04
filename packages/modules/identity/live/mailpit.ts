// Reading the stack's Mailpit (https://mail.chaku.localhost) from the live checks. Mailpit is shared
// by everyone using the stack, so checks send to addresses of their own and search by recipient.
import { existsSync } from 'node:fs';
import https from 'node:https';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '../../../..');

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

/**
 * GETs JSON from Mailpit's API. Node.js on Windows can't resolve `*.localhost`, so the lookup goes
 * to the loopback address; the certificate is `pnpm stack:check`'s business, not this check's.
 */
function mailpit<T>(apiPath: string): Promise<T> {
  return new Promise((resolve, reject) => {
    https
      .get(
        `https://mail.chaku.localhost${apiPath}`,
        {
          rejectUnauthorized: false,
          lookup: (_hostname, options, callback) => {
            if (options.all) callback(null, [{ address: '127.0.0.1', family: 4 }]);
            else callback(null, '127.0.0.1', 4);
          },
        },
        (response) => {
          let body = '';
          response.setEncoding('utf8');
          response.on('data', (chunk: string) => (body += chunk));
          response.on('end', () => {
            if (response.statusCode !== 200) {
              reject(new Error(`Mailpit ${apiPath}: ${String(response.statusCode)}`));
            } else resolve(JSON.parse(body) as T);
          });
        },
      )
      .on('error', reject);
  });
}

export interface MailpitMessage {
  Subject: string;
  Text: string;
  HTML: string;
  To: { Address: string }[];
}

/** The emails to `to`, newest first, waiting up to a few seconds for at least `count`. */
export async function emailsTo(to: string, count = 1): Promise<MailpitMessage[]> {
  const query = encodeURIComponent(`to:"${to}"`);
  for (let attempt = 0; attempt < 50; attempt++) {
    const search = await mailpit<{ messages: { ID: string }[] }>(`/api/v1/search?query=${query}`);
    if (search.messages.length >= count) {
      return Promise.all(
        search.messages.map((message) => mailpit<MailpitMessage>(`/api/v1/message/${message.ID}`)),
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Mailpit has fewer than ${String(count)} emails to ${to}.`);
}
