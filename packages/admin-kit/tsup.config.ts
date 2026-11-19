import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: {
      index: "src/index.ts",
      "core/index": "src/core/index.ts",
      "react/index": "src/react/index.ts",
      "express/index": "src/express/index.ts",
    },
    format: ["esm"],
    dts: true,
    sourcemap: true,
    clean: false,
    target: "es2022",
    external: ["react", "react-dom", "express"],
  },
  {
    entry: {
      "cli/index": "src/cli/index.ts",
    },
    format: ["esm"],
    dts: false,
    banner: {
      js: "#!/usr/bin/env node",
    },
    sourcemap: true,
    clean: false,
    target: "es2022",
    external: ["express"],
  },
]);
