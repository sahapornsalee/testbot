/**
 * Minimal EXIF reader for JPEG files: camera, date and GPS position.
 * Used to warn before sharing a photo; it never sends anything anywhere.
 */

export interface ExifInfo {
  make?: string;
  model?: string;
  dateTime?: string;
  gps?: { lat: number; lng: number };
}

const TAGS = { make: 0x010f, model: 0x0110, dateTime: 0x0132, exifIfd: 0x8769, gpsIfd: 0x8825, dateTimeOriginal: 0x9003 };

export function readExif(buffer: ArrayBuffer): ExifInfo | null {
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null;
  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset);
    const size = view.getUint16(offset + 2);
    if (marker === 0xffe1 && size >= 8 && view.getUint32(offset + 4) === 0x45786966 /* "Exif" */) {
      return parseTiff(view, offset + 10);
    }
    if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) break;
    offset += 2 + size;
  }
  return null;
}

function parseTiff(view: DataView, start: number): ExifInfo | null {
  if (start + 8 > view.byteLength) return null;
  const little = view.getUint16(start) === 0x4949;
  const u16 = (o: number) => view.getUint16(start + o, little);
  const u32 = (o: number) => view.getUint32(start + o, little);
  const inRange = (o: number, n: number) => start + o + n <= view.byteLength;

  const readIfd = (ifd: number): Map<number, { type: number; count: number; valueOffset: number }> => {
    const entries = new Map<number, { type: number; count: number; valueOffset: number }>();
    if (!inRange(ifd, 2)) return entries;
    const n = u16(ifd);
    for (let i = 0; i < n && inRange(ifd + 2 + i * 12, 12); i++) {
      const e = ifd + 2 + i * 12;
      entries.set(u16(e), { type: u16(e + 2), count: u32(e + 4), valueOffset: e + 8 });
    }
    return entries;
  };
  const ascii = (entry?: { count: number; valueOffset: number }) => {
    if (!entry) return undefined;
    const at = entry.count > 4 ? u32(entry.valueOffset) : entry.valueOffset;
    if (!inRange(at, entry.count)) return undefined;
    let s = "";
    for (let i = 0; i < entry.count; i++) {
      const c = view.getUint8(start + at + i);
      if (c === 0) break;
      s += String.fromCharCode(c);
    }
    return s.trim() || undefined;
  };
  const rationals = (entry?: { count: number; valueOffset: number }) => {
    if (!entry) return null;
    const at = u32(entry.valueOffset);
    if (!inRange(at, entry.count * 8)) return null;
    return Array.from({ length: entry.count }, (_, i) => {
      const den = u32(at + i * 8 + 4);
      return den === 0 ? 0 : u32(at + i * 8) / den;
    });
  };

  if (u16(2) !== 42) return null;
  const ifd0 = readIfd(u32(4));
  const info: ExifInfo = {};
  const make = ascii(ifd0.get(TAGS.make));
  const model = ascii(ifd0.get(TAGS.model));
  if (make) info.make = make;
  if (model) info.model = model;
  let dateTime = ascii(ifd0.get(TAGS.dateTime));
  const exifPtr = ifd0.get(TAGS.exifIfd);
  if (exifPtr) dateTime = ascii(readIfd(u32(exifPtr.valueOffset)).get(TAGS.dateTimeOriginal)) ?? dateTime;
  if (dateTime) info.dateTime = dateTime;
  const gpsPtr = ifd0.get(TAGS.gpsIfd);
  if (gpsPtr) {
    const gps = readIfd(u32(gpsPtr.valueOffset));
    const lat = rationals(gps.get(2));
    const lng = rationals(gps.get(4));
    const latRef = ascii(gps.get(1));
    const lngRef = ascii(gps.get(3));
    if (lat?.length === 3 && lng?.length === 3) {
      const toDeg = (v: number[]) => (v[0] as number) + (v[1] as number) / 60 + (v[2] as number) / 3600;
      info.gps = {
        lat: Math.round(toDeg(lat) * (latRef === "S" ? -1 : 1) * 1e6) / 1e6,
        lng: Math.round(toDeg(lng) * (lngRef === "W" ? -1 : 1) * 1e6) / 1e6,
      };
    }
  }
  return info;
}
