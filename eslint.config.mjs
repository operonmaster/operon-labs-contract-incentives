import js from "@eslint/js";
import next from "eslint-config-next";

export default [
  js.configs.recommended,
  ...next,
  {
    ignores: [
      ".next/**",
      "**/.next/**",
      "src/apps/web/.next/**",
      "src/apps/web/out/**",
      "node_modules/**",
      "coverage/**"
    ]
  }
];
