import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";
import path from "node:path";
import fs from "node:fs";

export default defineConfig({
  resolve: {
    preserveSymlinks: true,
  },
  plugins: [
    react(),
    dts({
      insertTypesEntry: true,
      include: ["src"],
    }),
    {
      name: "copy-spa-assets",
      closeBundle() {
        const src = path.resolve(__dirname, "../../examples/react-demo/dist");
        const dst = path.resolve(__dirname, "dist");
        if (fs.existsSync(src)) {
          fs.cpSync(src, dst, { recursive: true, force: true });
        }
      },
    },
  ],
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      name: "AdminKitReact",
      formats: ["es", "cjs"],
      fileName: (format) => (format === "es" ? "index.js" : "index.cjs"),
    },
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime"],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
          "react/jsx-runtime": "jsxRuntime",
        },
      },
    },
  },
});
