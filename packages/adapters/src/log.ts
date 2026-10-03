// Structured logs with pino (spec §5.5). Message and Comment bodies never reach a log (D9), and
// neither do emails or credentials: their fields are replaced before a line is written.
import { pino, type DestinationStream, type Level, type Logger } from 'pino';
import pretty from 'pino-pretty';

export type { Level, Logger };

const censor = '[redacted]';

/** Field names whose value never reaches a log, at the top level and up to three objects deep. */
const redactedFields = ['body', 'text', 'email', 'password', 'token', 'secret'];

/** Request and response headers that carry credentials. */
const redactedHeaders = ['cookie', 'set-cookie', 'authorization'];

function atAnyDepth(field: string): string[] {
  return [field, `*.${field}`, `*.*.${field}`, `*.*.*.${field}`];
}

export const redactPaths: string[] = [
  ...redactedFields.flatMap(atAnyDepth),
  ...redactedHeaders.flatMap((header) => atAnyDepth(`headers["${header}"]`)),
];

export interface LogOptions {
  /** Defaults to `info`. */
  level?: Level | 'silent';
  /** Human-readable lines instead of JSON. Only for development. */
  pretty?: boolean;
  /** Where lines go; defaults to standard output. Tests pass a stream to read them. */
  destination?: DestinationStream;
}

export function createLogger(options: LogOptions = {}): Logger {
  const destination =
    options.destination ??
    // A stream on the same thread, not a pino transport: transports start worker threads,
    // which Next.js bundles can't load.
    (options.pretty ? pretty({ colorize: true, sync: true }) : undefined);
  return pino(
    {
      level: options.level ?? 'info',
      redact: { paths: redactPaths, censor },
    },
    destination,
  );
}
