import { FlatCompat } from '@eslint/eslintrc';
import unusedImports from 'eslint-plugin-unused-imports';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
    baseDirectory: __dirname,
});

export default [
    {
        ignores: [
            'node_modules/**',
            '.next/**',
            'out/**',
            'build/**',
            'public/**',
            'next-env.d.ts',
        ],
    },
    ...compat.extends(
        'next/core-web-vitals',
        'next/typescript',
        'plugin:import/recommended',
        'plugin:prettier/recommended',
        'plugin:react-hooks/recommended',
        'plugin:react/recommended',
    ),
    {
        plugins: {
            'unused-imports': unusedImports,
        },
        rules: {
            '@typescript-eslint/ban-ts-comment': [
                'error',
                { 'ts-ignore': 'allow-with-description' },
            ],
            '@typescript-eslint/naming-convention': [
                'error',
                {
                    selector: 'function',
                    format: ['camelCase', 'PascalCase'],
                },
                {
                    selector: 'variable',
                    format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
                    leadingUnderscore: 'allow',
                },
                {
                    selector: 'typeLike',
                    format: ['PascalCase'],
                },
            ],
            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/no-unused-vars': 'off',
            '@typescript-eslint/no-var-requires': 'error',
            camelcase: 'off',
            curly: 'error',
            'function-paren-newline': 'off',
            'implicit-arrow-linebreak': 'off',
            'import/no-extraneous-dependencies': [
                'error',
                { devDependencies: true },
            ],
            'import/no-unresolved': 'off',
            'import/prefer-default-export': 'off',
            indent: 'off',
            'jsx-a11y/anchor-is-valid': [
                'error',
                {
                    aspects: ['invalidHref', 'preferButton'],
                    components: ['Link'],
                    specialLink: ['hrefLeft', 'hrefRight'],
                },
            ],
            'jsx-a11y/click-events-have-key-events': 'off',
            'jsx-a11y/control-has-associated-label': 'off',
            'jsx-a11y/no-static-element-interactions': 'off',
            'max-classes-per-file': 'off',
            'max-len': 'off',
            'no-console': 'off',
            'no-underscore-dangle': ['error', { allow: ['__typename'] }],
            'no-unused-vars': 'off',
            'no-useless-constructor': 'off',
            'object-curly-newline': 'off',
            'operator-linebreak': 'off',
            'prettier/prettier': 'error',
            'react-hooks/exhaustive-deps': 'error',
            'react/destructuring-assignment': ['error', 'always'],
            'react/display-name': 'error',
            'react/function-component-definition': 'off',
            'react/jsx-boolean-value': 'off',
            'react/jsx-curly-newline': 'off',
            'react/jsx-filename-extension': 'off',
            'react/jsx-indent': 'off',
            'react/jsx-indent-props': 'off',
            'react/jsx-one-expression-per-line': 'off',
            'react/jsx-props-no-spreading': 'off',
            'react/jsx-wrap-multilines': 'off',
            'react/no-danger': 'off',
            'react/no-unknown-property': ['error', { ignore: ['jsx'] }],
            'react/prefer-stateless-function': 'off',
            'react/prop-types': 'off',
            'react/react-in-jsx-scope': 'off',
            'react/require-default-props': 'off',
            'react/self-closing-comp': 'off',
            'unused-imports/no-unused-imports': 'warn',
            'unused-imports/no-unused-vars': [
                'warn',
                {
                    vars: 'all',
                    varsIgnorePattern: '^_',
                    args: 'after-used',
                    argsIgnorePattern: '^_',
                },
            ],
        },
    },
];
