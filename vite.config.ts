/// <reference types="vitest/config" />
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves a project site from /<repository>/.
// Override with BASE_PATH (e.g. "/" for a user site or custom domain).
const base = process.env.BASE_PATH ?? "/testbot/";

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

/**
 * Emits sw.js with the exact list of built files to precache. The cache
 * version is a hash of that list, so every deploy with changed files gets a
 * fresh cache and old caches are deleted on activation.
 */
function serviceWorker(): Plugin {
  return {
    name: "productivity-hub-service-worker",
    apply: "build",
    enforce: "post",
    generateBundle(_options, bundle) {
      const built = Object.keys(bundle).filter((file) => !file.endsWith(".map"));
      const publicFiles = listFiles("public").map((file) => relative("public", file).split("\\").join("/"));
      const precache = [...new Set(["index.html", ...built, ...publicFiles])].sort();
      const version = createHash("sha256").update(precache.join("\n")).digest("hex").slice(0, 12);
      const source = readFileSync("pwa/sw-template.js", "utf8")
        .replace("__VERSION__", version)
        .replace("__PRECACHE__", JSON.stringify(precache));
      this.emitFile({ type: "asset", fileName: "sw.js", source });
    },
  };
}

export default defineConfig({
  base,
  plugins: [react(), serviceWorker()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
