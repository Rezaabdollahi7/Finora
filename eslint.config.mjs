import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },

  /*
   * Design-system guardrails (rule G.7). These make the "no arbitrary values"
   * instruction enforceable instead of merely documented: the tokens live in
   * globals.css, so a literal colour in a component is always a mistake.
   *
   * Scoped to components and features -- globals.css is where real colour
   * values belong, and it is not linted here.
   */
  {
    files: ["src/components/**/*.tsx", "src/features/**/*.tsx", "src/app/**/*.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "JSXAttribute[name.name='className'] Literal[value=/(?:bg|text|border|fill|stroke|ring|shadow|from|to|via)-\\[#/]",
          message:
            "Arbitrary colour value. Use a design token utility (bg-card, text-muted-foreground, border-border, ...) — see docs/DESIGN_SYSTEM.md.",
        },
        {
          selector:
            "JSXAttribute[name.name='className'] Literal[value=/(?:^|\\s|:)-?(?:ml|mr|pl|pr)-/]",
          message:
            "Physical direction utility. Use the logical equivalent (ms/me/ps/pe) so the layout mirrors correctly in RTL — see rule G.6.",
        },
        {
          selector:
            "JSXAttribute[name.name='className'] Literal[value=/(?:^|\\s|:)-?(?:left|right)-/]",
          message:
            "Physical inset utility. Use start-*/end-* so the layout mirrors correctly in RTL — see rule G.6.",
        },
        {
          selector:
            "JSXAttribute[name.name='className'] Literal[value=/(?:^|\\s|:)(?:rounded|text|p|m|gap|w|h)-\\[[0-9]/]",
          message:
            "Arbitrary size value. Use the design system scale — see docs/DESIGN_SYSTEM.md §11 and §13.",
        },
      ],
    },
  },

  // Command-line scripts report to the terminal; that is their output.
  {
    files: ["scripts/**/*.{js,mjs,ts}"],
    rules: { "no-console": "off" },
  },

  // Prettier last: it only turns formatting rules off.
  prettier,

  globalIgnores([".next/**", "out/**", "build/**", "coverage/**", "next-env.d.ts"]),
]);

export default eslintConfig;
