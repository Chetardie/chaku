// Drives Better Auth the way a browser does: requests to `auth.handler`, cookies kept between
// them. Emails are captured instead of sent and every log line is kept, so tests can read the
// code and check that no secret was logged (D9). Integration tests against Mailpit are in live/.
import { Writable } from 'node:stream';

import type { BotCheck } from '@chaku/adapters/bot-check';
import type { EmailMessage, EmailSender } from '@chaku/adapters/email';
import { createLogger } from '@chaku/adapters/log';
import { createMemoryRateLimiter, type RateLimiter } from '@chaku/adapters/rate-limit';
import type { Database } from '@chaku/db';
import { eq } from 'drizzle-orm';

import { type AuthConfig, createAuth } from '../../src/auth/auth.ts';
import { members } from '../../src/schema.ts';

export const appUrl = 'https://chaku.localhost';

export const firefoxOnWindows =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0';
export const safariOnIphone =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1';

export class CapturingEmail implements EmailSender {
  readonly sent: EmailMessage[] = [];
  send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
    return Promise.resolve();
  }
  /** The last email to `to`. */
  last(to: string): EmailMessage {
    const message = this.sent.findLast((sent) => sent.to === to);
    if (!message) throw new Error(`No email was sent to ${to}.`);
    return message;
  }
}

export interface TestAuthOptions {
  config?: Partial<AuthConfig>;
  botCheck?: BotCheck;
  rateLimiter?: RateLimiter;
}

export function createTestAuth(db: Database, options: TestAuthOptions = {}) {
  const email = new CapturingEmail();
  const logLines: string[] = [];
  const log = createLogger({
    level: 'trace',
    destination: new Writable({
      write(chunk: Buffer, _encoding, done) {
        logLines.push(chunk.toString());
        done();
      },
    }),
  });
  const rateLimiter = options.rateLimiter ?? createMemoryRateLimiter();
  const auth = createAuth(
    {
      db,
      email,
      rateLimiter,
      botCheck: options.botCheck ?? { verify: () => Promise.resolve(true) },
      log,
      requestLocale: (headers) => (headers?.get('accept-language')?.startsWith('uk') ? 'uk' : 'en'),
    },
    {
      appUrl,
      secret: 'test-secret-that-is-only-used-in-tests-0000',
      passkeyRpId: 'chaku.localhost',
      ...options.config,
    },
  );
  return { auth, email, logLines, rateLimiter };
}

export type TestAuth = ReturnType<typeof createTestAuth>;

export interface AuthResponse {
  status: number;
  body: Record<string, unknown> | null;
  headers: Headers;
}

/** A browser: keeps cookies, sends a User-Agent and an Origin. */
export class Browser {
  readonly cookies = new Map<string, string>();
  private readonly testAuth: TestAuth;
  readonly userAgent: string;
  private readonly extraHeaders: Record<string, string>;

  constructor(
    testAuth: TestAuth,
    userAgent = firefoxOnWindows,
    extraHeaders: Record<string, string> = {},
  ) {
    this.testAuth = testAuth;
    this.userAgent = userAgent;
    this.extraHeaders = extraHeaders;
  }

  async request(
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ): Promise<AuthResponse> {
    const response = await this.testAuth.auth.handler(
      new Request(`${appUrl}/api/auth${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          origin: appUrl,
          'user-agent': this.userAgent,
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
          ...(this.cookies.size > 0 ? { cookie: this.cookieHeader() } : {}),
          ...this.extraHeaders,
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
    for (const setCookie of response.headers.getSetCookie()) {
      const [pair = '', ...attributes] = setCookie.split(';');
      const index = pair.indexOf('=');
      const name = pair.slice(0, index).trim();
      const value = pair.slice(index + 1).trim();
      const expired = attributes.some((attribute) => /^\s*max-age=0\s*$/i.test(attribute));
      if (expired || value === '') this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    const text = await response.text();
    return { status: response.status, body: parseJson(text), headers: response.headers };
  }

  cookieHeader(): string {
    return [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
  }

  /** The headers a later request to the app carries, for `auth.api.getSession`. */
  headers(): Headers {
    return new Headers({ cookie: this.cookieHeader(), 'user-agent': this.userAgent });
  }

  sessionToken(): string | undefined {
    const value = [...this.cookies].find(([name]) => name.endsWith('chaku.session_token'))?.[1];
    // The cookie is `<token>.<signature>`, URL-encoded.
    return value ? decodeURIComponent(value).split('.')[0] : undefined;
  }

  requestCode(email: string, headers?: Record<string, string>): Promise<AuthResponse> {
    return this.request('/email-otp/send-verification-otp', { email, type: 'sign-in' }, headers);
  }

  signInWithCode(email: string, otp: string): Promise<AuthResponse> {
    return this.request('/sign-in/email-otp', { email, otp });
  }

  signInWithLink(token: string): Promise<AuthResponse> {
    return this.request('/sign-in/email-link', { token });
  }

  /** Requests a code and logs in with it. */
  async logIn(email: string): Promise<AuthResponse> {
    const sent = await this.requestCode(email);
    if (sent.status !== 200) throw new Error(`Requesting a code failed: ${String(sent.status)}`);
    return this.signInWithCode(email, codeIn(this.testAuth.email.last(email)));
  }
}

/** The response body as JSON, or `null` when it is empty or not JSON (a 404 page). */
function parseJson(text: string): Record<string, unknown> | null {
  try {
    return text ? (JSON.parse(text) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function codeIn(message: EmailMessage): string {
  const code = /\b(\d{6})\b/.exec(message.text)?.[1];
  if (!code) throw new Error('The email has no 6-digit code.');
  return code;
}

export function linkTokenIn(message: EmailMessage): string {
  const token = /\/login\/link\?token=([\w-]+)/.exec(message.text)?.[1];
  if (!token) throw new Error('The email has no login link.');
  return token;
}

/** The seeded Member with this username. */
export async function seededMember(db: Database, username: string) {
  const [member] = await db.select().from(members).where(eq(members.username, username));
  if (!member) throw new Error(`The seed has no ${username}.`);
  return member;
}
