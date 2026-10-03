// Checks run once when the server starts, from instrumentation.ts.
import { InvalidEnvError, parseServerEnv } from '../env.ts';

/**
 * Stops the server when the environment is invalid, before it serves a single request. The
 * message names the variables, never their values.
 */
export function checkEnvironment(
  source: Record<string, string | undefined> = process.env,
  exit: (code: number) => never = (code) => process.exit(code),
  report: (message: string) => void = (message) => {
    console.error(message);
  },
): void {
  try {
    parseServerEnv(source);
  } catch (error) {
    if (!(error instanceof InvalidEnvError)) throw error;
    report(error.message);
    exit(1);
  }
}
