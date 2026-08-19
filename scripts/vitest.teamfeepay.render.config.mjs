import { defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify("https://demo.supabase.co"),
    "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify("demo-anon-key-12345678901234567890"),
    "import.meta.env.VITE_ENABLE_ACQUISITION_DEMO": JSON.stringify("true"),
  },
  test: {
    environment: "jsdom",
    environmentOptions: { jsdom: { url: "http://localhost/teamfeepay-demo" } },
    setupFiles: ["./tests/setup/browser-globals.js"],
    include: ["tests/**/*.{test,spec}.{js,jsx}"],
    globals: false,
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
    testTimeout: 15000,
  },
});
