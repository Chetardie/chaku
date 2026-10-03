// CHK-19: the email adapter delivers to Mailpit over SMTP (D23, ADR-0010). Needs `pnpm stack`.
import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { createSmtpEmail } from '../src/email.ts';
import { env, mailpit } from './env.ts';

interface MailpitSearch {
  messages: { ID: string; Subject: string; To: { Address: string }[] }[];
}

interface MailpitMessage {
  Text: string;
  HTML: string;
  From: { Address: string };
}

describe('email adapter (SMTP to Mailpit)', () => {
  it('sends an email that Mailpit receives', async () => {
    const subject = `Adapter check ${randomUUID()}`;
    const to = 'adapter-check@example.com';
    const email = createSmtpEmail({ url: env('SMTP_URL'), from: env('EMAIL_FROM') });

    await email.send({ to, subject, text: 'Plain text', html: '<p>HTML</p>' });

    const search = await mailpit<MailpitSearch>(
      `/api/v1/search?query=${encodeURIComponent(`subject:"${subject}"`)}`,
    );
    expect(search.messages).toHaveLength(1);
    const [found] = search.messages;
    expect(found?.To.map((recipient) => recipient.Address)).toEqual([to]);

    const message = await mailpit<MailpitMessage>(`/api/v1/message/${found?.ID ?? ''}`);
    expect(message.Text.trim()).toBe('Plain text');
    expect(message.HTML).toContain('<p>HTML</p>');
    expect(env('EMAIL_FROM')).toContain(message.From.Address);
  });
});
