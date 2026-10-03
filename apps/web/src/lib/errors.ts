// Error reporting in the browser. The console until Sentry's browser SDK arrives in phase 4 (D55);
// either way the context is scrubbed first (D9).
import { createLogErrorReporter } from '@chaku/adapters/errors';

export const browserErrors = createLogErrorReporter({
  error: (details, message) => {
    console.error(message, details);
  },
});
