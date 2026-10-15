import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "tests/**/*.test.ts"],
    testTimeout: 60000,
  },
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
});
