import stylex from "@stylexjs/unplugin/vite";
import react from "@vitejs/plugin-react";
import { reactCompiler } from "./react-compiler";

export function appPlugins() {
  return [
    reactCompiler(),
    stylex({
      useCSSLayers: true,
      runtimeInjection: false,
      devMode: "full",
    }),
    react({
      exclude: [/\/node_modules\//, /\.d\.[cm]?tsx?$/],
    }),
  ];
}
