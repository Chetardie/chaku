// Every module that has jobs, each through its public entry point (ADR-0003, ADR-0008). A new
// module with jobs is added here, with the adapters its handlers send through.
import type { EmailSender } from '@chaku/adapters/email';
import type { ModuleJobs } from '@chaku/db';
import { identityJobs } from '@chaku/identity';

export interface WorkerAdapters {
  email: EmailSender;
}

export function modules({ email }: WorkerAdapters): readonly ModuleJobs[] {
  return [identityJobs({ email })];
}
