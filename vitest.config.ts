import { defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    __APP_ENV__: JSON.stringify("test"),
    __EXEC_URL__: JSON.stringify(
      "https://script.google.com/macros/s/TEST_DEPLOYMENT/exec",
    ),
    __GIT_SHA__: JSON.stringify("testsha"),
  },
  test: {
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: [
        "src/shared/**/*.ts",
        "src/server/**/*.ts",
        "src/addon/**/*.ts",
        "src/web/**/*.ts",
      ],
      reporter: ["text-summary", "text"],
      // src/web is reported, not gated, in slice 3.
      thresholds: {
        "src/shared/**": { lines: 90 },
        "src/server/**": { lines: 75 },
      },
    },
  },
});
