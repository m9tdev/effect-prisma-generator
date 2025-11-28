// @ts-check

import eslint from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import { readFileSync } from "fs";
import { join } from "path";
import tseslint from "typescript-eslint";

// Read .gitignore and convert to glob patterns
const gitignorePath = join(import.meta.dirname, ".gitignore");
const gitignoreContent = readFileSync(gitignorePath, "utf8");
const gitignorePatterns = gitignoreContent
  .split("\n")
  .filter((line) => line && !line.startsWith("#"))
  .map((pattern) => pattern.trim());

export default defineConfig(
  globalIgnores(gitignorePatterns),
  eslint.configs.recommended,
  tseslint.configs.strict,
  {
    rules: {
      "comma-dangle": ["error", "always-multiline"],
    },
  },
);
