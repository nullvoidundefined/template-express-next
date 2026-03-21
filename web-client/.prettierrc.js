const config = {
    arrowParens: 'always',
    bracketSpacing: true,
    embeddedLanguageFormatting: 'auto',
    htmlWhitespaceSensitivity: 'css',
    importOrder: ['<THIRD_PARTY_MODULES>', '^@/.*', '^[./]'],
    importOrderSeparation: true,
    importOrderSortSpecifiers: true,
  insertPragma: false,
  jsxSingleQuote: false,
    overrides: [
        {
            files: '*.ts',
            options: {
                parser: 'typescript',
            },
        },
        {
            files: '*.tsx',
            options: {
                parser: 'typescript',
            },
        },
    ],
    parser: 'babel',
    plugins: [require.resolve('@trivago/prettier-plugin-sort-imports')],
    printWidth: 80,
    proseWrap: 'preserve',
    quoteProps: 'as-needed',
    requirePragma: false,
    semi: true,
    singleQuote: true,
    tabWidth: 4,
    trailingComma: 'all',
    useTabs: false,
    vueIndentScriptAndStyle: false,
};
module.exports = config;
