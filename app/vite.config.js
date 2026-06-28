import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base so the build works at any GitHub Pages sub-path
// (served at https://<user>.github.io/voyage-app/app/). The app uses
// query-string navigation (?recap=token), not path routing, so "./" is safe.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: false,
    target: "es2020",
  },
});
