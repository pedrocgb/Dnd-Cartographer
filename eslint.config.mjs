import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const LOCALIZED_GLOBS = [
  // Batch 0: foundation
  "src/app/layout.tsx",
  "src/components/settings/GeneralSettings.tsx",
  "src/components/settings/SettingsProvider.tsx",
  // Batch 1: shell and shared primitives
  "src/components/AppNav.tsx",
  "src/components/WorldDateLabel.tsx",
  "src/components/Modal.tsx",
  "src/components/ConfirmDialog.tsx",
  "src/components/Skeleton.tsx",
  "src/components/LoadingScreen.tsx",
  "src/components/SearchBox.tsx",
  "src/components/DatePicker.tsx",
  "src/components/IconPicker.tsx",
  "src/components/Toggle.tsx",
  "src/components/ToolSection.tsx",
  "src/components/worlds/**",
  "src/app/worlds/**",
  // Batch 2: settings, trash, import/export
  "src/components/settings/**",
  "src/app/settings/**",
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Hover text goes through TooltipLayer (data-tooltip), never the browser's native title box.
  {
    rules: {
      "react/forbid-dom-props": ["error", { forbid: [{ propName: "title", message: "Use data-tooltip (TooltipLayer) instead of the native title tooltip." }] }],
      "react/forbid-component-props": ["error", { forbid: [{ propName: "title", disallowedFor: ["Link", "Image"], message: "Use data-tooltip (TooltipLayer) instead of the native title tooltip." }] }],
      "react/forbid-elements": ["error", { forbid: [{ element: "title", message: "Put data-tooltip on the SVG element instead of an SVG <title>." }] }],
    },
  },
  // Localized files (docs/localization.md): visible text goes through t(), so no bare strings in JSX.
  // Each localization batch adds its files here. Props aren't checked; the batch's grep covers them.
  // Allowed: punctuation, and the app's name (a brand, never translated).
  {
    files: LOCALIZED_GLOBS,
    rules: {
      "react/jsx-no-literals": ["error", { noStrings: true, ignoreProps: true, allowedStrings: ["·", "—", "–", "/", "×", "%", ":", "(", ")", "…", "+", "-", "|", "World Wiki"] }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
