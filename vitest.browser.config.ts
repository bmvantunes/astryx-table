import { defineConfig } from "vite-plus";
import { playwright } from "vite-plus/test/browser-playwright";
import { appPlugins } from "./config/plugins";

export default defineConfig({
  resolve: { dedupe: ["react", "react-dom"] },
  optimizeDeps: {
    include: [
      "@astryxdesign/core/Toolbar",
      "react",
      "react-dom",
      "react/jsx-runtime",
      "@tanstack/react-table",
      "@tanstack/react-pacer",
      "@tanstack/react-hotkeys",
    ],
  },
  define: { __ASTRYX_TABLE_DEVELOPMENT__: "true", __ASTRYX_TABLE_TEST_DIAGNOSTICS__: "true" },
  plugins: appPlugins(),
  test: {
    include: ["src/**/*.browser.test.tsx"],
    exclude: ["src/**/*.performance.browser.test.tsx"],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
    },
  },
});
