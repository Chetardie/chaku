// apps/worker: runs Graphile Worker jobs (ADR-0008). SIGTERM or SIGINT stops taking jobs, waits for
// the running ones, closes the pool and exits 0; a second signal stops at once.
import { createLogger } from '@chaku/adapters/log';
import { closeDatabase, createDatabase } from '@chaku/db';

import { InvalidEnvError, parseWorkerEnv } from './env.ts';
import { modules } from './modules.ts';
import { startWorker } from './runner.ts';

function environment() {
  try {
    return parseWorkerEnv(process.env);
  } catch (error) {
    if (!(error instanceof InvalidEnvError)) throw error;
    console.error(error.message);
    process.exit(1);
  }
}

const env = environment();
const log = createLogger({ level: env.LOG_LEVEL, pretty: env.NODE_ENV === 'development' });
const db = createDatabase(env.DATABASE_URL, {
  onError: (error) => {
    log.error({ err: error }, 'Postgres connection error');
  },
});
const runner = await startWorker({ db, log, modules, concurrency: env.WORKER_CONCURRENCY });
log.info({ concurrency: env.WORKER_CONCURRENCY }, 'Worker started');

let stopping = false;
async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (stopping) {
    log.warn({ signal }, 'Stopping at once');
    await runner.kill(signal);
    process.exit(1);
  }
  stopping = true;
  log.info({ signal }, 'Stopping after the running jobs');
  await runner.stop(signal);
  await closeDatabase(db);
  log.info('Worker stopped');
  process.exit(0);
}
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.on(signal, (s) => void shutdown(s));

try {
  await runner.promise;
} catch (error) {
  log.fatal({ err: error }, 'Worker failed');
  process.exit(1);
}
