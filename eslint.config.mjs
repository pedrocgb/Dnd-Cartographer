import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

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
