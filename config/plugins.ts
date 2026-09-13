import stylex from "@stylexjs/unplugin/vite";
import react from "@vitejs/plugin-react";

export function appPlugins() {
  return [
    stylex({
      useCSSLayers: true,
      runtimeInjection: false,
      devMode: "full",
    }),
    react({
      compiler: { compilationMode: "infer", panicThreshold: "all_errors", target: "19" },
      exclude: [/\/node_modules\//, /\.d\.[cm]?tsx?$/],
    }),
  ];
}
