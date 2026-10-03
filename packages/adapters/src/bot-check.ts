// Bot checks (D44). Cloudflare Turnstile protects the logged-out report form and the email step of
// email login. It arrives in phase 4 (D55), with Cloudflare's test keys in previews and end-to-end
// tests; locally every check passes.

export interface BotCheckInput {
  /** The token the widget put in the form; missing when the widget didn't run. */
  token: string | undefined;
  /** The visitor's IP address, which Turnstile checks the token against. */
  ip?: string;
}

export interface BotCheck {
  verify(input: BotCheckInput): Promise<boolean>;
}

export function createPassingBotCheck(): BotCheck {
  return { verify: () => Promise.resolve(true) };
}
