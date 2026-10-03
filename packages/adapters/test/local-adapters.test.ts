// CHK-19: the push, analytics and bot-check adapters run their local versions until phase 4 (D55).
import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  createNoopAnalytics,
  type Analytics,
  type AnalyticsEvents,
  type ClosedProperties,
} from '../src/analytics.ts';
import { createPassingBotCheck } from '../src/bot-check.ts';
import { createLogPush } from '../src/push.ts';

describe('push (log adapter)', () => {
  it('logs the push service host, never the endpoint path or the payload', async () => {
    const logged: unknown[] = [];
    const push = createLogPush({ info: (details: unknown) => logged.push(details) });
    const result = await push.send({
      subscription: {
        endpoint: 'https://push.example.com/device-path-9d2b',
        keys: { p256dh: 'key', auth: 'auth' },
      },
      payload: 'Message text that must stay private',
      ttl: 60,
    });
    expect(result).toBe('sent');
    expect(logged).toEqual([{ pushService: 'push.example.com', ttl: 60 }]);
  });
});

describe('analytics (no-op)', () => {
  it('accepts a declared event and sends nothing', () => {
    const analytics = createNoopAnalytics();
    expect(() => {
      analytics.capture('message_sent', { chatKind: 'group' }, 'member-id');
    }).not.toThrow();
  });

  it('has only closed properties: numbers, booleans and fixed words (D9)', () => {
    expectTypeOf<{
      [E in keyof AnalyticsEvents]: ClosedProperties<AnalyticsEvents[E]>;
    }>().toEqualTypeOf<AnalyticsEvents>();
  });

  it('rejects free text at compile time', () => {
    expectTypeOf<ClosedProperties<{ note: string }>>().toBeNever();
    expectTypeOf<ClosedProperties<{ count: number; kind: 'a' | 'b' }>>().toEqualTypeOf<{
      count: number;
      kind: 'a' | 'b';
    }>();
    const capture: Analytics['capture'] = () => undefined;
    // @ts-expect-error: a word outside the declared set is free text.
    capture('message_sent', { chatKind: 'hello' }, 'member-id');
  });
});

describe('bot check (local)', () => {
  it('always passes', async () => {
    await expect(createPassingBotCheck().verify({ token: undefined })).resolves.toBe(true);
  });
});
