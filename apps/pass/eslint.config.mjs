import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Le projet Android est du Java, du Kotlin et du Gradle : ESLint n'a rien
    // à y faire, et `android/app/build/` contient des artefacts générés.
    "android/**",
  ]),
]);

export default eslintConfig;
