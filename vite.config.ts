import { defineConfig } from "vite-plus";
import { appPlugins } from "./config/plugins";

export default defineConfig({
  // Node tests have no JSX/CSS; Browser Mode has its own full plugin configuration.
  plugins: process.env.VITEST ? [] : appPlugins(),
  test: { include: ["src/**/*.test.ts"], environment: "node" },
  pack: {
    entry: ["packages/table/src/index.ts"],
    outDir: "packages/table/dist",
    dts: true,
  },
});
