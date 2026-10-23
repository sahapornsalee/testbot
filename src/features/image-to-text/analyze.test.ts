import { describe, expect, it } from "vitest";
import { buildPrompt, colorGrid, colorName, dominantColors, orientation, toAscii, type Pixels } from "./analyze";

/** Builds an image from a function of (x, y) -> [r, g, b, a?]. */
function image(width: number, height: number, fn: (x: number, y: number) => number[]): Pixels {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r = 0, g = 0, b = 0, a = 255] = fn(x, y);
      data.set([r, g, b, a], (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

describe("toAscii", () => {
  it("draws dark pixels as dense characters and keeps proportions", () => {
    // Left half black, right half white.
    const img = image(40, 20, (x) => (x < 20 ? [0, 0, 0] : [255, 255, 255]));
    const lines = toAscii(img, 20).split("\n");
    expect(lines).toHaveLength(5); // 20 columns * (20/40) * 0.5
    for (const line of lines) expect(line).toBe("@".repeat(10));
  });

  it("treats transparent pixels as white", () => {
    expect(toAscii(image(10, 10, () => [0, 0, 0, 0]), 10).trim()).toBe("");
  });

  it("clamps the width", () => {
    expect(toAscii(image(500, 10, () => [0, 0, 0]), 1000).split("\n")[0]).toHaveLength(200);
  });
});

describe("colours", () => {
  it("finds dominant colours with shares and Thai names", () => {
    const img = image(100, 100, (x) => (x < 75 ? [220, 30, 30] : [30, 60, 200]));
    const colors = dominantColors(img);
    expect(colors[0]).toMatchObject({ name: "แดง", percent: 75, hex: "#DC1E1E" });
    expect(colors[1]).toMatchObject({ name: "น้ำเงิน", percent: 25 });
  });

  it("names neutrals and shades", () => {
    expect(colorName({ r: 0, g: 0, b: 0 })).toBe("ดำ");
    expect(colorName({ r: 255, g: 255, b: 255 })).toBe("ขาว");
    expect(colorName({ r: 128, g: 128, b: 128 })).toBe("เทา");
    expect(colorName({ r: 40, g: 160, b: 60 })).toBe("เขียว");
    expect(colorName({ r: 120, g: 70, b: 20 })).toBe("น้ำตาล");
    expect(colorName({ r: 60, g: 30, b: 10 })).toBe("น้ำตาลเข้ม");
    expect(colorName({ r: 20, g: 40, b: 120 })).toBe("น้ำเงินเข้ม");
    expect(colorName({ r: 255, g: 200, b: 210 })).toBe("ชมพูอ่อน");
    expect(colorName({ r: 250, g: 220, b: 40 })).toBe("เหลือง");
  });

  it("ignores fully transparent images", () => {
    expect(dominantColors(image(10, 10, () => [0, 0, 0, 0]))).toEqual([]);
  });

  it("builds a coarse colour grid", () => {
    const img = image(4, 2, (x) => (x < 2 ? [255, 0, 0] : [0, 0, 255]));
    expect(colorGrid(img, 2, 1)).toEqual([["#FF0000", "#0000FF"]]);
  });

  it("describes orientation", () => {
    expect(orientation(1920, 1080)).toBe("แนวนอน");
    expect(orientation(1080, 1920)).toBe("แนวตั้ง");
    expect(orientation(500, 520)).toBe("จัตุรัส");
  });
});

describe("buildPrompt", () => {
  const base = {
    fileName: "slip.png",
    fileType: "image/png",
    fileSize: 2048,
    width: 800,
    height: 1200,
    question: "",
    ocrText: "โอนเงินสำเร็จ\n500.00 บาท",
    ocrConfidence: 91.4,
    colors: [{ hex: "#FFFFFF", name: "ขาว", percent: 80 }],
    ascii: "@@  \n  @@",
    grid: [["#FFFFFF", "#000000"]],
  };

  it("includes every section and a default question", () => {
    const text = buildPrompt(base);
    expect(text).toContain("slip.png (image/png, 2.0 KB)");
    expect(text).toContain("800 × 1200 พิกเซล (แนวตั้ง)");
    expect(text).toContain("ขาว #FFFFFF 80%");
    expect(text).toContain("ความมั่นใจเฉลี่ย 91%");
    expect(text).toContain('"""\nโอนเงินสำเร็จ\n500.00 บาท\n"""');
    expect(text).toContain("กว้าง 4 ตัว");
    expect(text).toContain("#FFFFFF #000000");
    expect(text).toContain("รูปนี้คืออะไร");
  });

  it("omits sections that were turned off and uses the user's question", () => {
    const text = buildPrompt({ ...base, ocrText: null, ascii: null, grid: null, question: "ยอดโอนเท่าไร" });
    expect(text).not.toContain("OCR");
    expect(text).not.toContain("ภาพร่าง");
    expect(text).not.toContain("แผนที่สี");
    expect(text.endsWith("ยอดโอนเท่าไร")).toBe(true);
  });

  it("says when OCR found no text", () => {
    expect(buildPrompt({ ...base, ocrText: "  ", ocrConfidence: null })).toContain("(ไม่พบข้อความในรูป)");
  });
});

describe("cleanOcrText", async () => {
  const { cleanOcrText } = await import("./analyze");
  it("joins Thai characters split by spaces and tidies whitespace", () => {
    // Single spaces between Thai characters are OCR artifacts; a wide gap is kept as one space.
    expect(cleanOcrText("โ อ น เงิน   สำเร็จ\n\n\n\n500.00  บาท  ")).toBe("โอนเงิน สำเร็จ\n\n500.00 บาท");
    expect(cleanOcrText("Hello World")).toBe("Hello World");
    // nikhahit + sara aa becomes sara am, so the text matches what people type.
    expect(cleanOcrText("โอนเงินส\u0E4D\u0E32เร็จ")).toBe("โอนเงินสำเร็จ");
  });
});
