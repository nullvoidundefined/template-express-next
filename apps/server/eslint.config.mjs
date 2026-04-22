import tsEslintParser from '@typescript-eslint/parser';
import eslintConfigPrettier from 'eslint-config-prettier';
import security from 'eslint-plugin-security';
import unusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config([
  {
    ignores: [
      'dist',
      'build',
      'node_modules',
      '**/*.d.ts',
      'vitest.config.ts',
      'vitest.integration.config.ts',
    ],
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
    extends: [security.configs.recommended],
    plugins: {
      security,
      'unused-imports': unusedImports,
    },
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      curly: 'error',
      'no-console': ['warn', { allow: ['warn', 'info', 'error', 'group'] }],
      'no-implicit-globals': 'error',
      'no-param-reassign': ['error', { props: false }],
      'no-shadow': 'warn',
      'no-undef': 'error',
      'no-underscore-dangle': 'off',
      'no-unreachable': 'warn',
      'no-unused-expressions': 'error',
      'no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-useless-escape': 'off',
      'no-var': 'warn',
      'object-shorthand': ['error', 'always'],
      'prefer-const': 'warn',
      'security/detect-eval-with-expression': 'warn',
      'security/detect-non-literal-fs-filename': 'warn',
      'security/detect-non-literal-regexp': 'warn',
      'security/detect-non-literal-require': 'warn',
      'security/detect-object-injection': 'off',
      'security/detect-possible-timing-attacks': 'warn',
      'unused-imports/no-unused-imports': 'warn',
    },
  },
  {
    files: ['**/*.ts'],
    extends: [...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      parser: tsEslintParser,
      parserOptions: {
        ecmaVersion: 'latest',
        project: ['./tsconfig.json'],
        sourceType: 'module',
      },
    },
    rules: {
      '@typescript-eslint/ban-ts-comment': [
        'warn',
        { 'ts-ignore': 'allow-with-description' },
      ],
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { fixStyle: 'inline-type-imports', prefer: 'type-imports' },
      ],
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-misused-promises': [
        'warn',
        { checksVoidReturn: { attributes: false } },
      ],
      '@typescript-eslint/no-require-imports': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/require-await': 'off',
      'no-undef': 'off',
      'no-var': 'warn',
      'prefer-const': 'warn',
    },
  },
  {
    files: [
      '**/__tests__/**',
      '**/__mocks__/**',
      '**/tests/**',
      '**/*.test.ts',
    ],
    languageOptions: {
      globals: { ...globals.jest },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      'no-console': 'off',
      'security/detect-non-literal-regexp': 'off',
    },
  },
  eslintConfigPrettier,
]);
