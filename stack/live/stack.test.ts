// CHK-14: `pnpm stack` brings every service to healthy. Runs against the running stack
// (`pnpm stack:check`); CI starts it on a clean runner first.
import { describe, expect, it } from 'vitest';

import { compose, loadEnv } from '../src/stack.ts';

loadEnv();

interface ComposeService {
  Service: string;
  State: string;
  Health: string;
}

describe('the local stack', () => {
  it('runs every service in docker-compose.yml, and every one is healthy', () => {
    const declared = compose(['config', '--services']).trim().split(/\r?\n/).sort();
    const running = compose(['ps', '--all', '--format', 'json'])
      .trim()
      .split(/\r?\n/)
      .map((line) => JSON.parse(line) as ComposeService);

    expect(running.map((service) => service.Service).sort()).toEqual(declared);
    for (const service of running) {
      expect({ service: service.Service, state: service.State, health: service.Health }).toEqual({
        service: service.Service,
        state: 'running',
        health: 'healthy',
      });
    }
  });

  it('answers on Redis', () => {
    expect(compose(['exec', '-T', 'redis', 'redis-cli', 'ping']).trim()).toBe('PONG');
  });
});
