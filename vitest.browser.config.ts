import { defineConfig } from "vite-plus";
import { playwright } from "vite-plus/test/browser-playwright";
import { appPlugins } from "./config/plugins";

export default defineConfig({
  plugins: appPlugins(),
  test: {
    include: ["src/**/*.browser.test.tsx"],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
    },
  },
});
