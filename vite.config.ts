/// <reference types="vitest/config" />
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";
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

const require = createRequire(import.meta.url);
const tesseractDir = dirname(require.resolve("tesseract.js/package.json"));
const coreDir = dirname(createRequire(join(tesseractDir, "package.json")).resolve("tesseract.js-core/package.json"));
const langDir = (lang: string) => join(dirname(require.resolve(`@tesseract.js-data/${lang}/package.json`)), "4.0.0_best_int");
/** Versioned so an engine upgrade never mixes with files cached by an older one. */
const OCR_DIR = `ocr/${(JSON.parse(readFileSync(join(tesseractDir, "package.json"), "utf8")) as { version: string }).version}`;

/**
 * OCR engine files served from our own site (no third-party CDN), so the
 * image never leaves the device and OCR works offline after first use.
 * Only the LSTM engine builds are needed; the browser loads one of them.
 */
export const OCR_FILES: Record<string, string> = {
  [`${OCR_DIR}/worker.min.js`]: join(tesseractDir, "dist/worker.min.js"),
  [`${OCR_DIR}/core/tesseract-core-relaxedsimd-lstm.wasm.js`]: join(coreDir, "tesseract-core-relaxedsimd-lstm.wasm.js"),
  [`${OCR_DIR}/core/tesseract-core-simd-lstm.wasm.js`]: join(coreDir, "tesseract-core-simd-lstm.wasm.js"),
  [`${OCR_DIR}/core/tesseract-core-lstm.wasm.js`]: join(coreDir, "tesseract-core-lstm.wasm.js"),
  [`${OCR_DIR}/lang/tha.traineddata.gz`]: join(langDir("tha"), "tha.traineddata.gz"),
  [`${OCR_DIR}/lang/eng.traineddata.gz`]: join(langDir("eng"), "eng.traineddata.gz"),
};

function ocrAssets(): Plugin {
  return {
    name: "productivity-hub-ocr-assets",
    generateBundle() {
      for (const [fileName, source] of Object.entries(OCR_FILES)) {
        this.emitFile({ type: "asset", fileName, source: readFileSync(source) });
      }
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split("?")[0]?.replace(base, "") ?? "";
        const source = OCR_FILES[path];
        if (!source) return next();
        res.setHeader("Content-Type", path.endsWith(".js") ? "text/javascript" : "application/octet-stream");
        res.end(readFileSync(source));
      });
    },
  };
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
      // OCR files (~5 MB per device) are cached on first use, in their own cache, instead of precached.
      const built = Object.keys(bundle).filter((file) => !file.endsWith(".map") && !file.startsWith("ocr/"));
      const publicFiles = listFiles("public").map((file) => relative("public", file).split("\\").join("/"));
      const precache = [...new Set(["index.html", ...built, ...publicFiles])].sort();
      const version = createHash("sha256").update(precache.join("\n")).digest("hex").slice(0, 12);
      const source = readFileSync("pwa/sw-template.js", "utf8")
        .replace("__VERSION__", version)
        .replace("__OCR_DIR__", OCR_DIR)
        .replace("__PRECACHE__", JSON.stringify(precache));
      this.emitFile({ type: "asset", fileName: "sw.js", source });
    },
  };
}

export default defineConfig({
  base,
  plugins: [react(), ocrAssets(), serviceWorker()],
  define: { __OCR_DIR__: JSON.stringify(OCR_DIR) },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
