import { base, designTokens, node, react } from '@chaku/config/eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig(globalIgnores(['storybook-static/']), base, node, react, designTokens);
