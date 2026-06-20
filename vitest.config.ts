import { defineConfig } from "vitest/config";

export default defineConfig({
  oxc: {
    jsx: {
      runtime: "automatic",
      importSource: "react"
    }
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    // The React/happy-dom and child-process route tests are stable with bounded parallelism.
    maxWorkers: 4
  }
});
