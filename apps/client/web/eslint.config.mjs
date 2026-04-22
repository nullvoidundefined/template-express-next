import { FlatCompat } from '@eslint/eslintrc';
import tsEslintParser from '@typescript-eslint/parser';
import eslintConfigPrettier from 'eslint-config-prettier';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import security from 'eslint-plugin-security';
import unusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';
import { dirname } from 'path';
import tseslint from 'typescript-eslint';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

export default tseslint.config([
  {
    ignores: ['node_modules', '.next', 'out', 'build', '**/*.d.ts'],
  },
  // Extend next/core-web-vitals; filter react-hooks to avoid plugin conflict below
  ...compat
    .extends('next/core-web-vitals', 'next/typescript')
    .filter((config) => !config.plugins?.['react-hooks']),
  {
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
    extends: [security.configs.recommended],
    plugins: {
      security,
      'unused-imports': unusedImports,
    },
    rules: {
      curly: 'error',
      'import/no-anonymous-default-export': 'off',
      'no-console': ['warn', { allow: ['warn', 'info', 'error', 'group'] }],
      'no-implicit-globals': 'error',
      'no-param-reassign': ['error', { props: false }],
      'no-shadow': 'warn',
      'no-undef': 'error',
      'no-underscore-dangle': 'off',
      'no-unreachable': 'warn',
      'no-unused-expressions': 'error',
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
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      ecmaVersion: 'latest',
      parser: tsEslintParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: 'latest',
        project: ['./tsconfig.json'],
        sourceType: 'module',
      },
    },
    plugins: {
      'jsx-a11y': jsxA11y,
      react,
      'react-hooks': reactHooks,
    },
    settings: {
      react: { version: 'detect' },
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
      'jsx-a11y/anchor-is-valid': 'warn',
      'jsx-a11y/click-events-have-key-events': 'off',
      'jsx-a11y/iframe-has-title': 'off',
      'jsx-a11y/interactive-supports-focus': 'off',
      'jsx-a11y/no-autofocus': 'warn',
      'jsx-a11y/no-noninteractive-element-interactions': 'off',
      'jsx-a11y/no-static-element-interactions': 'off',
      'no-var': 'warn',
      'prefer-const': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/rules-of-hooks': 'warn',
      'react/display-name': 'warn',
      'react/jsx-curly-brace-presence': ['error', 'never'],
      'react/no-unescaped-entities': 'warn',
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
      'unused-imports/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: [
      '**/__tests__/**',
      '**/__mocks__/**',
      '**/tests/**',
      '**/*.test.ts',
      '**/*.test.tsx',
    ],
    languageOptions: {
      globals: { ...globals.vitest },
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
