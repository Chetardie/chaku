// Every module that has jobs, each through its public entry point (ADR-0003, ADR-0008). A new
// module with jobs is added here.
import type { ModuleJobs } from '@chaku/db';
import { identityJobs } from '@chaku/identity';

export const modules: readonly ModuleJobs[] = [identityJobs];
