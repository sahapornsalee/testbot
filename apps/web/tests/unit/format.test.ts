import { describe, expect, it } from "vitest";
import { describeFormat, formatBytes, formatDuration } from "@/lib/format";

describe("format helpers", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(30 * 1024 * 1024)).toBe("30 MB");
    expect(formatBytes(null)).toBeNull();
    expect(formatBytes(-1)).toBeNull();
  });

  it("formats durations", () => {
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(3725)).toBe("1:02:05");
    expect(formatDuration(null)).toBeNull();
  });

  it("describes formats without inventing data", () => {
    expect(describeFormat({ height: 1080, fps: 60, abr: null, ext: "mp4", note: null, vcodec: "avc1.64", acodec: null })).toBe("1080p60 · MP4 · avc1");
    expect(describeFormat({ height: null, fps: null, abr: 129.4, ext: "m4a", note: null, vcodec: null, acodec: "mp4a.40.2" })).toBe("129 kbps · M4A · mp4a");
  });
});
