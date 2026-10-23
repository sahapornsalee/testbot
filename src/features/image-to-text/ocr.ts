import type { Worker } from "tesseract.js";
import { cleanOcrText } from "./analyze";

export interface OcrProgress {
  stage: "loading" | "recognizing";
  /** 0–1 */
  progress: number;
}

let workerPromise: Promise<Worker> | null = null;
let onProgress: ((p: OcrProgress) => void) | null = null;

/** Our own copies of the engine and language files (see vite.config.ts). */
function assetUrl(path: string): string {
  return new URL(`${import.meta.env.BASE_URL}${__OCR_DIR__}/${path}`, window.location.origin).href;
}

function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = import("tesseract.js")
      .then(({ createWorker, OEM }) =>
        createWorker(["tha", "eng"], OEM.LSTM_ONLY, {
          workerPath: assetUrl("worker.min.js"),
          corePath: assetUrl("core"),
          langPath: assetUrl("lang"),
          workerBlobURL: false,
          gzip: true,
          logger: (m: { status: string; progress: number }) => {
            onProgress?.({ stage: m.status === "recognizing text" ? "recognizing" : "loading", progress: m.progress ?? 0 });
          },
        }),
      )
      .catch((error: unknown) => {
        workerPromise = null;
        throw error;
      });
  }
  return workerPromise;
}

/** Reads Thai and English text from an image entirely in the browser. */
export async function recognizeText(
  image: HTMLCanvasElement | Blob,
  progress?: (p: OcrProgress) => void,
): Promise<{ text: string; confidence: number }> {
  onProgress = progress ?? null;
  try {
    const worker = await getWorker();
    const { data } = await worker.recognize(image);
    return { text: cleanOcrText(data.text), confidence: data.confidence };
  } finally {
    onProgress = null;
  }
}
