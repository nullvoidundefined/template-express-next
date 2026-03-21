// @ts-check
import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";
import importPlugin from "eslint-plugin-import";
import prettierPlugin from "eslint-plugin-prettier";

export default defineConfig(
  {
    // Replacement for .eslintignore
    ignores: ["dist/**", "node_modules/**"],
  },
  {
    // Global language options for the project
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
  },
  // Core ESLint recommended rules
  eslint.configs.recommended,
  // TypeScript ESLint recommended rules
  tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      import: importPlugin,
      prettier: prettierPlugin,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        // Enable type-aware linting using the project service
        projectService: true,
      },
    },
    rules: {
      // Run Prettier as an ESLint rule
      "prettier/prettier": "error",
      // Require app/ alias; no relative imports (./ or ../)
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["./**", "../**"], message: "Use the app/ alias instead of relative paths." },
          ],
        },
      ],
      "import/order": [
        "error",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
          "newlines-between": "always",
          pathGroups: [{ pattern: "app/**", group: "internal", position: "after" }],
          pathGroupsExcludedImportTypes: ["builtin"],
          alphabetize: {
            order: "asc",
            caseInsensitive: true,
          },
        },
      ],
    },
  },
);
