// identity's emails as react-email 6 components, rendered to HTML and plain text. Styling is neutral
// for now: no colours, so nothing here needs the design tokens yet (ADR-0015). The module's
// source runs straight in Node.js (the seed, the worker in development), which can't strip JSX,
// so the components are built with `createElement`.
import { createElement as h, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  render,
  Section,
  Text,
} from 'react-email';

import type { EmailMessage } from '@chaku/adapters/email';

import { emailMessages, type EmailLocale } from './messages.ts';

const font = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const body: CSSProperties = { fontFamily: font, margin: 0, padding: '24px 0' };
const container: CSSProperties = { maxWidth: '480px', margin: '0 auto', padding: '0 16px' };
const text: CSSProperties = { fontSize: '16px', lineHeight: '24px', margin: '0 0 16px' };
const code: CSSProperties = {
  fontSize: '32px',
  fontWeight: 700,
  letterSpacing: '8px',
  lineHeight: '40px',
  margin: '0 0 16px',
};
const button: CSSProperties = {
  border: '2px solid',
  borderRadius: '8px',
  display: 'inline-block',
  fontSize: '16px',
  fontWeight: 600,
  padding: '12px 20px',
  textDecoration: 'none',
};
const small: CSSProperties = { fontSize: '13px', lineHeight: '20px', margin: '0' };

function layout(locale: EmailLocale, preview: string, children: ReactNode[]): ReactElement {
  return h(
    Html,
    { lang: locale },
    h(Head),
    h(Preview, null, preview),
    h(
      Body,
      { style: body },
      h(
        Container,
        { style: container },
        ...children,
        h(Hr),
        h(Text, { style: small }, emailMessages[locale].footer),
      ),
    ),
  );
}

const paragraph = (content: string) => h(Text, { style: text }, content);

async function toEmail(to: string, subject: string, element: ReactElement): Promise<EmailMessage> {
  const [html, plain] = await Promise.all([render(element), render(element, { plainText: true })]);
  return { to, subject, html, text: plain };
}

export interface LoginCodeEmail {
  to: string;
  locale: EmailLocale;
  code: string;
  /** The page with the "Log in" button (D32). */
  linkUrl: string;
  validMinutes: number;
}

/** The login email: a 6-digit code and a link (ADR-0010). */
export function loginCodeEmail(email: LoginCodeEmail): Promise<EmailMessage> {
  const t = emailMessages[email.locale].loginCode;
  return toEmail(
    email.to,
    t.subject,
    layout(email.locale, t.preview, [
      paragraph(t.intro),
      h(Text, { style: code }, email.code),
      paragraph(t.validFor(email.validMinutes)),
      h(
        Section,
        { style: { margin: '0 0 24px' } },
        h(Button, { href: email.linkUrl, style: button }, t.button),
      ),
      paragraph(t.ignore),
    ]),
  );
}

export interface EmailChangeCodeEmail {
  /** The new address. */
  to: string;
  locale: EmailLocale;
  code: string;
  validMinutes: number;
}

/** The code that confirms a new email address (D37). No link: the change happens in Settings. */
export function emailChangeCodeEmail(email: EmailChangeCodeEmail): Promise<EmailMessage> {
  const t = emailMessages[email.locale].emailChangeCode;
  return toEmail(
    email.to,
    t.subject,
    layout(email.locale, t.subject, [
      paragraph(t.intro),
      h(Text, { style: code }, email.code),
      paragraph(t.validFor(email.validMinutes)),
      paragraph(t.ignore),
    ]),
  );
}

export interface NewDeviceEmail {
  to: string;
  locale: EmailLocale;
  /** The stored label, `''` when unknown. */
  device: string;
  time: string;
}

export function newDeviceEmail(email: NewDeviceEmail): Promise<EmailMessage> {
  const messages = emailMessages[email.locale];
  const t = messages.newDevice;
  return toEmail(
    email.to,
    t.subject,
    layout(email.locale, t.preview, [
      paragraph(t.intro(email.device || messages.unknownDevice, email.time)),
      paragraph(t.ifYou),
      paragraph(t.ifNot),
    ]),
  );
}

export interface EmailChangedEmail {
  /** The old address. */
  to: string;
  locale: EmailLocale;
  time: string;
}

export function emailChangedEmail(email: EmailChangedEmail): Promise<EmailMessage> {
  const t = emailMessages[email.locale].emailChanged;
  return toEmail(
    email.to,
    t.subject,
    layout(email.locale, t.subject, [
      paragraph(t.intro(email.time)),
      paragraph(t.ifYou),
      paragraph(t.ifNot),
    ]),
  );
}
