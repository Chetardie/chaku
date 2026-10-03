// Email (D23, D52). Locally and in previews every email goes to Mailpit over SMTP (ADR-0010);
// production sends through Resend from phase 4 (D55).
import { createTransport } from 'nodemailer';

export interface EmailMessage {
  to: string;
  subject: string;
  /** The plain-text version. Every email has one. */
  text: string;
  html?: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

export interface SmtpEmailOptions {
  /** `smtp://host:port`, from `SMTP_URL`. */
  url: string;
  /** The sender, from `EMAIL_FROM`. */
  from: string;
}

export function createSmtpEmail(options: SmtpEmailOptions): EmailSender {
  const transport = createTransport(options.url);
  return {
    async send(message) {
      await transport.sendMail({ from: options.from, ...message });
    },
  };
}
