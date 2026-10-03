// CHK-19: logs never hold Message or Comment bodies, emails, cookies or `authorization` headers (D9).
import { describe, expect, it } from 'vitest';

import { createLogger } from '../src/log.ts';

const secret = 'not-for-logs-7f3a';

/** A logger that collects its JSON lines. */
function capture() {
  const lines: string[] = [];
  const logger = createLogger({ destination: { write: (line: string) => lines.push(line) } });
  return { logger, output: () => lines.join('') };
}

describe('logger', () => {
  it.each([
    ['a Message body', { body: secret }],
    ['a Comment body inside a payload', { comment: { body: secret } }],
    ['text', { input: { text: secret } }],
    ['an email', { member: { email: `${secret}@example.com` } }],
    ['a cookie', { req: { headers: { cookie: `session=${secret}` } } }],
    ['a set-cookie header', { res: { headers: { 'set-cookie': `session=${secret}` } } }],
    ['an authorization header', { headers: { authorization: `Bearer ${secret}` } }],
    ['a token two levels deep', { a: { b: { token: secret } } }],
  ])('redacts %s', (_, fields) => {
    const { logger, output } = capture();
    logger.info(fields, 'something happened');
    expect(output()).toContain('something happened');
    expect(output()).toContain('[redacted]');
    expect(output()).not.toContain(secret);
  });

  it('keeps everything else', () => {
    const { logger, output } = capture();
    logger.info({ path: 'chat.send', code: 'RATE_LIMITED', chatId: 'c-1' }, 'refused');
    expect(JSON.parse(output())).toMatchObject({
      level: 30,
      msg: 'refused',
      path: 'chat.send',
      code: 'RATE_LIMITED',
      chatId: 'c-1',
    });
  });

  it('writes JSON lines unless asked for pretty output', () => {
    const { logger, output } = capture();
    logger.warn('plain');
    expect(() => JSON.parse(output()) as unknown).not.toThrow();
  });
});
