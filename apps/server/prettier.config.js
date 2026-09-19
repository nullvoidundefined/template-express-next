export default {
  arrowParens: 'always',
  bracketSpacing: true,
  htmlWhitespaceSensitivity: 'css',
  importOrder: [
    '^react$',
    '^react-dom',
    '.*\\.css$',
    // Node built-ins come before third-party modules, as import-x/order requires.
    '^node:(.*)$',
    '<THIRD_PARTY_MODULES>',
    // Path-alias imports form their own group after third-party modules, the
    // layout the harness push ESLint gate (import-x/order) requires.
    '^app/(.*)$',
    '^[../]',
    '^[./]',
  ],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
  jsxSingleQuote: true,
  overrides: [
    {
      // Code samples in Markdown docs are illustrative; do not import-sort them.
      files: ['*.md'],
      options: {
        embeddedLanguageFormatting: 'off',
      },
    },
    {
      files: ['*.json'],
      options: {
        parser: 'json5',
        quoteProps: 'preserve',
        singleQuote: false,
        trailingComma: 'none',
      },
    },
    {
      files: ['.*rc'],
      options: {
        parser: 'json5',
        quoteProps: 'preserve',
        singleQuote: false,
        trailingComma: 'none',
      },
    },
    {
      files: ['*.yml', '*.yaml'],
      options: {
        singleQuote: true,
      },
    },
  ],
  plugins: ['@trivago/prettier-plugin-sort-imports'],
  printWidth: 80,
  quoteProps: 'as-needed',
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'all',
  useTabs: false,
};
