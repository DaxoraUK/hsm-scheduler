import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    environmentOptions: {
      jsdom: {
        url: "https://ground-control.test/",
      },
    },
    setupFiles: ["./tests/setup/browser-globals.js"],
    include: ["tests/**/*.test.js"],
    globals: false,
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      reportsDirectory: "coverage",
      include: [
        "src/lib/scheduler.js",
        "src/lib/fullTimeParser.js",
        "src/lib/date/weekendCalendar.js",
        "src/lib/date/matchweekCalendar.js",
        "src/lib/domain/clubDomain.js",
        "src/lib/domain/pitchClosures.js",
        "src/lib/settings/workspaceSettings.js",
        "src/lib/engines/parkingEngine.js",
        "src/lib/engines/recommendationEngine.js",
        "src/lib/engines/rulesEngine.js",
        "src/lib/engines/validationEngine.js",
        "src/lib/intelligence/officials/*.js",
        "src/lib/intelligence/parking/*.js",
        "src/lib/intelligence/pitch/*.js",
        "src/lib/intelligence/scheduling/*.js",
        "src/lib/registry/pitchRegistry.js",
        "src/lib/services/weatherService.js",
      ],
      thresholds: {
        statements: 55,
        branches: 45,
        functions: 65,
        lines: 60,
      },
      exclude: ["**/*.test.js"],
    },
  },
});
