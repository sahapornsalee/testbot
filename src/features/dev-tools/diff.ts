export type DiffLine = { type: "same" | "added" | "removed"; text: string; oldLine?: number; newLine?: number };

export const MAX_DIFF_LINES = 3000;

/** Line diff using the longest common subsequence. */
export function diffLines(oldText: string, newText: string): { ok: true; lines: DiffLine[] } | { ok: false; error: string } {
  const a = oldText === "" ? [] : oldText.split(/\r\n|\r|\n/);
  const b = newText === "" ? [] : newText.split(/\r\n|\r|\n/);
  if (a.length > MAX_DIFF_LINES || b.length > MAX_DIFF_LINES) return { ok: false, error: `รองรับไม่เกิน ${MAX_DIFF_LINES.toLocaleString()} บรรทัดต่อฝั่ง` };
  const n = a.length;
  const m = b.length;
  // lcs[i][j] = LCS length of a[i..] and b[j..], stored flat for speed.
  const lcs = new Uint16Array((n + 1) * (m + 1));
  const at = (i: number, j: number) => lcs[i * (m + 1) + j] as number;
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i * (m + 1) + j] = a[i] === b[j] ? at(i + 1, j + 1) + 1 : Math.max(at(i + 1, j), at(i, j + 1));
    }
  }
  const lines: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) {
      lines.push({ type: "same", text: a[i] as string, oldLine: i + 1, newLine: j + 1 });
      i++;
      j++;
    } else if (j < m && (i >= n || at(i, j + 1) >= at(i + 1, j))) {
      lines.push({ type: "added", text: b[j] as string, newLine: j + 1 });
      j++;
    } else {
      lines.push({ type: "removed", text: a[i] as string, oldLine: i + 1 });
      i++;
    }
  }
  return { ok: true, lines };
}
