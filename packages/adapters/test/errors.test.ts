// CHK-19: error reports are scrubbed of request bodies, cookies and query strings (D9).
import { describe, expect, it } from 'vitest';

import { createLogErrorReporter, scrubErrorContext } from '../src/errors.ts';

const secret = 'not-for-reports-5c1e';

const context = {
  tags: { procedure: 'chat.send' },
  request: {
    method: 'POST',
    url: `https://chaku.localhost/rpc/chat/send?draft=${secret}#${secret}`,
    headers: {
      'content-type': 'application/json',
      Cookie: `session=${secret}`,
      authorization: `Bearer ${secret}`,
    },
    body: { body: secret },
  },
};

describe('scrubErrorContext', () => {
  it('drops the body, credential headers and the query string', () => {
    expect(scrubErrorContext(context)).toEqual({
      tags: { procedure: 'chat.send' },
      request: {
        method: 'POST',
        url: 'https://chaku.localhost/rpc/chat/send',
        headers: { 'content-type': 'application/json' },
      },
    });
  });

  it('copies rather than changes what it was given', () => {
    scrubErrorContext(context);
    expect(context.request.body).toEqual({ body: secret });
  });
});

describe('log error reporter', () => {
  it('logs the error with the scrubbed context only', () => {
    const logged: object[] = [];
    const reporter = createLogErrorReporter({ error: (details) => logged.push(details) });
    reporter.capture(new Error('boom'), context);
    expect(logged).toHaveLength(1);
    expect(JSON.stringify(logged)).not.toContain(secret);
    expect(logged[0]).toMatchObject({ err: new Error('boom'), tags: { procedure: 'chat.send' } });
  });
});
