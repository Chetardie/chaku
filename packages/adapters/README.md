# @chaku/adapters

Every outside vendor sits behind an adapter here, with a local or no-op implementation (D23, ADR-0006). Until phase 4 the apps use only those (D55); the production implementations (Resend, R2 credentials, Sentry, PostHog, Turnstile) arrive with their accounts.

The package holds no data and imports no module. `apps/web`, `apps/worker` and `apps/realtime` all use it.

| Entry point | Interface | Local implementation |
|---|---|---|
| `@chaku/adapters/log` | `pino` `Logger` | `createLogger()`: JSON, or pretty in development. Message and Comment bodies, emails, cookies and `authorization` headers are redacted (D9) |
| `@chaku/adapters/email` | `EmailSender` | `createSmtpEmail()`: SMTP to Mailpit |
| `@chaku/adapters/storage` | `Storage` | `createS3Storage()`: the S3 API, SeaweedFS locally and R2 in production. Pre-signed links are signed for the public endpoint |
| `@chaku/adapters/push` | `PushSender` | `createLogPush()`: logs the push service's host, never the payload |
| `@chaku/adapters/analytics` | `Analytics` | `createNoopAnalytics()`. Events and their properties are a closed, typed set, so no content fits in them (D19) |
| `@chaku/adapters/errors` | `ErrorReporter` | `createLogErrorReporter()`: logs the error. `scrubErrorContext()` strips request bodies, cookies and query strings (D9) |
| `@chaku/adapters/bot-check` | `BotCheck` | `createPassingBotCheck()`: always passes (D44) |
| `@chaku/adapters/rate-limit` | `RateLimiter` | `createRedisRateLimiter()`: `rate-limiter-flexible` on Redis, falling back to memory while Redis is down; `createMemoryRateLimiter()` for unit tests. The limits are the calling module's config (D56) |

`errors`, `analytics` and `bot-check` import nothing from Node.js, so browser code can use them too.

## Tests

- `pnpm test`: unit tests, no services needed.
- `pnpm check`: the email, storage and rate-limit adapters against the running stack (`pnpm stack`). CI runs it in the `stack` job.
