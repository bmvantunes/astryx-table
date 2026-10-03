import { defineConfig } from "vite-plus";
import { playwright } from "vite-plus/test/browser-playwright";

// Deliberately no StyleX or React Compiler plugin: the installed library is already compiled.
export default defineConfig({
  resolve: { dedupe: ["react", "react-dom"] },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "@bmvantunes/astryx-table",
      "@astryxdesign/core/theme",
      "@astryxdesign/theme-neutral/built",
    ],
  },
  test: {
    include: ["*.browser.test.tsx"],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
    },
  },
});
