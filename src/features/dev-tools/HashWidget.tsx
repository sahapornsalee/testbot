import { useEffect, useState } from "react";
import { COPY_LABEL, useCopy } from "../../hooks/useCopy";
import { digest, HASH_ALGORITHMS, type HashAlgorithm } from "./hash";
import "./devtools.css";

const MAX_FILE_BYTES = 200 * 1024 * 1024;

export default function HashWidget() {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [hashes, setHashes] = useState<Partial<Record<HashAlgorithm, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [copyState, copy] = useCopy();
  const [copied, setCopied] = useState<HashAlgorithm | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const data = file ? await file.arrayBuffer() : text;
        const entries = await Promise.all(HASH_ALGORITHMS.map(async (alg) => [alg, await digest(alg, data)] as const));
        if (!cancelled) {
          setHashes(Object.fromEntries(entries));
          setError(null);
        }
      } catch {
        if (!cancelled) setError("คำนวณ Hash ไม่ได้ (ต้องเปิดผ่าน HTTPS)");
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [text, file]);

  return (
    <div className="stack">
      <label className="field">
        ข้อความ
        <textarea className="input" rows={3} value={text} disabled={file !== null} onChange={(e) => setText(e.target.value)} />
      </label>
      <div className="button-row">
        <label className="btn small">
          เลือกไฟล์…
          <input
            type="file"
            className="visually-hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              if (f && f.size > MAX_FILE_BYTES) {
                setError("ไฟล์ใหญ่เกิน 200 MB");
                return;
              }
              setFile(f);
            }}
          />
        </label>
        {file && (
          <>
            <span className="small muted">
              {file.name} ({(file.size / 1024).toLocaleString("th-TH", { maximumFractionDigits: 1 })} KB)
            </span>
            <button type="button" className="btn small" onClick={() => setFile(null)}>
              ใช้ข้อความแทน
            </button>
          </>
        )}
      </div>
      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : (
        HASH_ALGORITHMS.map((alg) => (
          <div key={alg} className="hash-row">
            <div className="button-row">
              <strong className="small">{alg}</strong>
              <button
                type="button"
                className="btn small"
                disabled={!hashes[alg]}
                onClick={() => {
                  copy(hashes[alg] ?? "");
                  setCopied(alg);
                }}
              >
                {copied === alg ? COPY_LABEL[copyState] : "คัดลอก"}
              </button>
            </div>
            <code aria-label={`${alg} hash`}>{hashes[alg] ?? "…"}</code>
          </div>
        ))
      )}
      <p className="muted small">ใช้ตรวจว่าไฟล์ดาวน์โหลดตรงกับต้นฉบับ ไฟล์ไม่ถูกอัปโหลดไปที่ใด</p>
    </div>
  );
}
