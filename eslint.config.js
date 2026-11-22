import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "dist",
      "node_modules",
      "src-tauri/target",
      "src-tauri/gen",
      ".worktrees",
      "playwright-report",
      "test-results",
      "blob-report",
      // Vendored agent-skill tooling (gitignored), not project source.
      ".claude",
      ".github/skills",
      "eslint.config.js",
    ],
  },
  js.configs.recommended,
  {
    // Plain browser scripts shipped as static assets (pre-paint bootstrap).
    files: ["public/**/*.js"],
    languageOptions: { globals: globals.browser },
  },
  {
    // Node ESM build/release scripts (run via `node`/`bun`, not bundled).
    files: ["scripts/**/*.mjs"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    // Playwright fixtures hand their value over through a `use` callback, which
    // the React hooks rules mistake for the `use` hook.
    files: ["e2e/**/*.ts"],
    rules: { "react-hooks/rules-of-hooks": "off" },
  },
  {
    // shadcn-style primitives legitimately co-export variant helpers.
    files: ["src/components/ui/**/*.{ts,tsx}"],
    rules: { "react-refresh/only-export-components": "off" },
  },
  prettier,
);
