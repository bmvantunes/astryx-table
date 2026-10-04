import config from "./vitest.config.ts";

export default {
  ...config,
  optimizeDeps: {
    ...config.optimizeDeps,
    include: [
      ...(config.optimizeDeps?.include ?? []),
      "effect",
      "effect-view-server/config",
      "effect-view-server/react",
      "effect-view-server/react/testing",
      "react-dom/client",
      "react-dom/server",
    ],
  },
};
