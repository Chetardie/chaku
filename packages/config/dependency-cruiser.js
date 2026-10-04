// Module boundaries from ADR-0002, ADR-0003 and ADR-0007, checked in CI by `pnpm boundaries`.
// depcruise runs from the repo root, so every path below is relative to it.

/** A module's single public entry point (ADR-0003). */
const moduleEntry = String.raw`^packages/modules/[^/]+/src/index\.[cm]?[jt]sx?$`;

/** @type {import('dependency-cruiser').IConfiguration} */
export default {
  forbidden: [
    {
      name: 'no-deep-import-between-modules',
      comment:
        'A module uses another module only through its public entry point, src/index (ADR-0003).',
      severity: 'error',
      from: { path: '^packages/modules/([^/]+)/' },
      to: { path: '^packages/modules/', pathNot: ['^packages/modules/$1/', moduleEntry] },
    },
    {
      name: 'no-deep-import-into-modules',
      comment: 'Apps and packages use a module only through its public entry point (ADR-0003).',
      severity: 'error',
      from: { pathNot: '^packages/modules/' },
      to: { path: '^packages/modules/', pathNot: moduleEntry },
    },
    {
      name: 'games-import-only-game-sdk-and-ui',
      comment:
        'A Game imports its own code, game-sdk and ui, never app code (ADR-0002). config is for its tooling files.',
      severity: 'error',
      from: { path: '^apps/games/([^/]+)/' },
      to: {
        path: '^(apps|packages)/',
        pathNot: ['^apps/games/$1/', '^packages/(game-sdk|ui|config)/'],
      },
    },
    {
      name: 'no-imports-between-apps',
      comment: 'Each app is its own deploy; apps share code through packages, not each other.',
      severity: 'error',
      from: { path: '^apps/([^/]+)/' },
      to: { path: '^apps/', pathNot: '^apps/$1/' },
    },
    {
      name: 'packages-import-no-app',
      comment: 'Packages are imported by apps, never the other way round.',
      severity: 'error',
      from: { path: '^packages/' },
      to: { path: '^apps/' },
    },
    {
      name: 'shared-packages-import-no-module',
      comment:
        'content, game-sdk, ui, config, db and adapters are plain libraries that own no data and import no module (ADR-0007, ADR-0002).',
      severity: 'error',
      from: { path: '^packages/(content|game-sdk|ui|config|db|adapters)/' },
      to: { path: '^packages/modules/' },
    },
    {
      name: 'graphile-worker-only-in-the-worker',
      comment:
        'Only apps/worker runs jobs, and @chaku/db/migrate installs their schema. Everything else adds jobs with addJob from @chaku/db (ADR-0008).',
      severity: 'error',
      from: { pathNot: ['^apps/worker/', String.raw`^packages/db/src/migrate\.ts$`] },
      to: { path: '(^|/)graphile-worker/' },
    },
    {
      name: 'no-circular',
      comment: 'Cycles make modules impossible to change or split out on their own.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'not-to-unresolvable',
      comment:
        "Every import resolves. A deep import that a package's exports don't allow ends up here.",
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    // Packages' own node_modules folders aren't crawled; npm packages stay in the graph as leaves,
    // so a rule can name one (graphile-worker-only-in-the-worker).
    exclude: {
      path: String.raw`(^|/)(dist|\.next|\.turbo|coverage|storybook-static)/|^(apps|packages)/.*node_modules/`,
    },
    // Type-only imports cross boundaries too.
    tsPreCompilationDeps: true,
    // Workspace packages resolve through their package.json exports, like Node and bundlers do.
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types', 'typings'],
    },
    skipAnalysisNotInRules: true,
  },
};
