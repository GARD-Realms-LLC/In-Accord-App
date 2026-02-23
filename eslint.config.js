// ESLint flat config (ESLint v9+)
// Covers TS/TSX/JS in src/ and scripts/.

const js = require("@eslint/js");
const globals = require("globals");
const tsParser = require("@typescript-eslint/parser");
const tsPlugin = require("@typescript-eslint/eslint-plugin");
const reactHooks = require("eslint-plugin-react-hooks");

/** @type {import('eslint').Linter.FlatConfig[]} */
module.exports = [
  {
    linterOptions: {
      // This repo contains many legacy/intentional eslint-disable comments.
      // Treating unused disables as warnings breaks CI when --max-warnings 0 is used.
      reportUnusedDisableDirectives: "off",
    },
    ignores: [
      // Not part of the app source; bundled/third-party BetterDiscord plugin files.
      "plugins/**",
      "Images/**",
      "assets/**",
      "**/*.plugin.js",

      // Launcher UI build outputs / generated bundles
      "scripts/launcher-ui/**",

      "dist/**",
      "**/node_modules/**",
      "**/.bun/**",
      "**/.cache/**",
      "**/*.min.js",
      // Build artifacts from electron-builder output
      "dist/launcher-build-win32-latest/**",
      "dist/ia-launcher-win.exe",
    ],
  },

  // This config file itself is CommonJS and runs in Node.
  {
    files: ["eslint.config.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-undef": "off",
    },
  },

  // Base JS recommendations
  js.configs.recommended,

  // JS / JSX parsing defaults
  {
    files: ["**/*.{js,jsx,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      // This codebase intentionally uses empty blocks (especially catch blocks).
      "no-empty": "off",
      "no-console": "off",
      "no-useless-escape": "off",
      "no-unused-vars": "off",
    },
  },

  // Browser/renderer globals for app UI/runtime
  {
    files: ["src/**/*.{js,jsx,ts,tsx}", "assets/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },

  // Node globals for scripts (build/inject helpers)
  {
    files: ["scripts/**/*.{js,cjs,mjs,ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // TypeScript / TSX
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "react-hooks": reactHooks,
    },
    rules: {
      // TypeScript handles undefined names/types better than ESLint core.
      "no-undef": "off",
      "no-redeclare": "off",
      "no-prototype-builtins": "off",
      "no-empty": "off",

      // Prefer TS-aware unused vars.
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",

      // TS code frequently uses any in Discord-internals.
      "@typescript-eslint/no-explicit-any": "off",

      // Keep the codebase pragmatic.
      "@typescript-eslint/ban-ts-comment": "off",

      // The project uses some require() calls in Electron contexts.
      "@typescript-eslint/no-require-imports": "off",

      // Do not enforce hooks rules globally (Discord internals + patchers).
      "react-hooks/rules-of-hooks": "off",
      "react-hooks/exhaustive-deps": "off",
    },
  },

  // CommonJS scripts + Electron main
  {
    files: [
      "scripts/**/*.{js,cjs,mjs}",
      "src/electron/**/*.{js,cjs,mjs,ts,tsx}",
    ],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-console": "off",
    },
  },
];
