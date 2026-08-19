import { defineConfig } from "vitest/config";

// Deliberately isolated from the repository's normal Vitest configuration.
// Node 22 can expose a non-functional experimental localStorage getter unless
// --localstorage-file is supplied. The acquisition gate instead installs a
// deterministic in-memory browser storage shim through this explicit setup.
export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup/browser-globals.js"],
    include: ["tests/**/*.test.js"],
    globals: false,
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
  },
});
