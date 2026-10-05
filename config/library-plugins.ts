import stylex from "@stylexjs/unplugin/rolldown";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite-plus";
import { reactCompiler } from "./react-compiler";

export function libraryPlugins() {
  const definitions: Plugin = {
    name: "astryx-table-production-defines",
    options(options) {
      return {
        ...options,
        transform: {
          ...options.transform,
          define: {
            ...options.transform?.define,
            __ASTRYX_TABLE_TEST_DIAGNOSTICS__: "false",
            __ASTRYX_TABLE_DEVELOPMENT__: 'globalThis.process?.env?.NODE_ENV === "development"',
          },
        },
      };
    },
  };
  return [
    definitions,
    reactCompiler(),
    stylex({ useCSSLayers: true, runtimeInjection: false }),
    ...react({
      exclude: [/\/node_modules\//, /\.d\.[cm]?tsx?$/],
    }),
  ];
}
