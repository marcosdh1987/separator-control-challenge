import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextCoreWebVitals,
  ...nextTypeScript,
  globalIgnores([
    ".next/**",
    ".venv/**",
    ".agents/**",
    ".claude/**",
    ".codex/**",
    ".opencode/**",
    ".github/skills-external/**",
    "coverage/**",
    "playwright-report/**",
  ]),
]);
