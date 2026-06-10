// Root-level Prettier config. Covers e2e/, docs/, playwright.config.ts,
// lefthook.yml, and any other top-level files not inside a workspace.
// Workspace configs (apps/server, apps/client/web) extend these same
// settings and add import-sort plugins.
export default {
  arrowParens: 'always',
  bracketSpacing: true,
  printWidth: 80,
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'all',
  useTabs: false,
};
