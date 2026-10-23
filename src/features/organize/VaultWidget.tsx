import { useEffect, useRef, useState } from "react";
import { Lock, LockOpen, Plus, Trash2 } from "lucide-react";
import { readJson, removeKey, writeJson } from "../../lib/storage";
import { decryptEntries, encryptEntries, newEntry, parseVault, passwordProblem, VAULT_KEY, WrongPasswordError, type VaultEntry } from "./vault";

const AUTO_LOCK_MS = 5 * 60_000;

export default function VaultWidget() {
  const [exists, setExists] = useState(() => readJson(VAULT_KEY, parseVault, null).value !== null);
  const [entries, setEntries] = useState<VaultEntry[] | null>(null);
  const password = useRef<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastActivity, setLastActivity] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  const lock = () => {
    password.current = null;
    setEntries(null);
    setSelected(null);
  };

  // Auto-lock after a period without edits.
  useEffect(() => {
    if (!entries) return;
    const id = window.setTimeout(lock, AUTO_LOCK_MS);
    return () => window.clearTimeout(id);
  }, [entries, lastActivity]);

  // Save (re-encrypt) shortly after changes.
  useEffect(() => {
    if (!entries || !password.current || lastActivity === 0) return;
    const pw = password.current;
    const id = window.setTimeout(() => {
      setStatus("กำลังเข้ารหัสและบันทึก…");
      void encryptEntries(entries, pw).then((vault) => setStatus(writeJson(VAULT_KEY, vault) ? "บันทึกแบบเข้ารหัสแล้ว" : "บันทึกไม่สำเร็จ"));
    }, 800);
    return () => window.clearTimeout(id);
  }, [entries, lastActivity]);

  const touch = (next: VaultEntry[]) => {
    setEntries(next);
    setLastActivity(Date.now());
  };

  if (!exists) {
    return (
      <PasswordForm
        title="สร้างที่เก็บข้อมูลลับ"
        confirm
        busy={busy}
        error={error}
        submitLabel="สร้างและเข้ารหัส"
        onSubmit={async (pw) => {
          setBusy(true);
          const vault = await encryptEntries([], pw);
          writeJson(VAULT_KEY, vault);
          password.current = pw;
          setExists(true);
          setEntries([]);
          setBusy(false);
        }}
        setError={setError}
      />
    );
  }

  if (!entries) {
    return (
      <PasswordForm
        title="ปลดล็อกข้อมูลลับ"
        busy={busy}
        error={error}
        submitLabel="ปลดล็อก"
        setError={setError}
        onSubmit={async (pw) => {
          const vault = readJson(VAULT_KEY, parseVault, null).value;
          if (!vault) {
            setExists(false);
            return;
          }
          setBusy(true);
          try {
            const list = await decryptEntries(vault, pw);
            password.current = pw;
            setEntries(list);
            setSelected(list[0]?.id ?? null);
            setError(null);
            setStatus(null);
          } catch (e) {
            setError(e instanceof WrongPasswordError ? e.message : "เปิดข้อมูลไม่สำเร็จ");
          } finally {
            setBusy(false);
          }
        }}
        onReset={() => {
          if (window.confirm("ลบที่เก็บข้อมูลลับทั้งหมด? ข้อมูลข้างในจะหายถาวรและกู้คืนไม่ได้")) {
            removeKey(VAULT_KEY);
            setExists(false);
          }
        }}
      />
    );
  }

  const current = entries.find((e) => e.id === selected) ?? null;
  return (
    <div className="stack">
      <div className="button-row">
        <span className="success-text small">
          <LockOpen aria-hidden="true" size={14} /> ปลดล็อกอยู่ (ล็อกเองเมื่อไม่ได้ใช้ 5 นาที)
        </span>
        <button type="button" className="btn small" onClick={lock}>
          <Lock aria-hidden="true" size={14} /> ล็อกตอนนี้
        </button>
        <button
          type="button"
          className="btn small"
          onClick={() => {
            const e = newEntry();
            touch([...entries, e]);
            setSelected(e.id);
          }}
        >
          <Plus aria-hidden="true" size={14} /> รายการใหม่
        </button>
        {status && (
          <span className="small muted" role="status">
            {status}
          </span>
        )}
      </div>
      {entries.length === 0 ? (
        <p className="muted empty-hint">ยังไม่มีข้อมูล กด “รายการใหม่”</p>
      ) : (
        <div className="prompt-layout">
          <ul className="prompt-list" aria-label="รายการข้อมูลลับ">
            {entries.map((e) => (
              <li key={e.id}>
                <button type="button" aria-current={e.id === selected ? "true" : undefined} onClick={() => setSelected(e.id)}>
                  {e.title.trim() || "ไม่มีชื่อ"}
                </button>
              </li>
            ))}
          </ul>
          {current && (
            <div className="stack">
              <input className="input" aria-label="ชื่อรายการ" placeholder="เช่น รหัส Wi-Fi บ้าน" value={current.title} onChange={(ev) => touch(entries.map((e) => (e.id === current.id ? { ...e, title: ev.target.value } : e)))} />
              <textarea className="input" rows={8} aria-label="ข้อมูลลับ" value={current.body} onChange={(ev) => touch(entries.map((e) => (e.id === current.id ? { ...e, body: ev.target.value } : e)))} />
              <button
                type="button"
                className="btn small btn-danger"
                onClick={() => {
                  if (!window.confirm(`ลบ “${current.title || "รายการนี้"}”?`)) return;
                  touch(entries.filter((e) => e.id !== current.id));
                  setSelected(null);
                }}
              >
                <Trash2 aria-hidden="true" size={14} /> ลบรายการนี้
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PasswordForm(props: {
  title: string;
  confirm?: boolean;
  busy: boolean;
  error: string | null;
  submitLabel: string;
  onSubmit: (password: string) => Promise<void>;
  setError: (e: string | null) => void;
  onReset?: () => void;
}) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        const problem = props.confirm ? passwordProblem(pw, pw2) : pw ? null : "กรุณาใส่รหัสผ่าน";
        if (problem) return props.setError(problem);
        props.setError(null);
        void props.onSubmit(pw);
      }}
    >
      <h3 className="settings-heading">
        <Lock aria-hidden="true" size={16} /> {props.title}
      </h3>
      <label className="field">
        รหัสผ่าน
        <input className="input" type="password" autoComplete={props.confirm ? "new-password" : "current-password"} value={pw} onChange={(e) => setPw(e.target.value)} />
      </label>
      {props.confirm && (
        <label className="field">
          ยืนยันรหัสผ่าน
          <input className="input" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        </label>
      )}
      {props.error && (
        <p className="error-text small" role="alert">
          {props.error}
        </p>
      )}
      <div className="button-row">
        <button type="submit" className="btn btn-primary" disabled={props.busy}>
          {props.busy ? "กำลังประมวลผล…" : props.submitLabel}
        </button>
        {props.onReset && (
          <button type="button" className="btn small" onClick={props.onReset}>
            ลืมรหัสผ่าน (ลบทั้งหมด)
          </button>
        )}
      </div>
      <p className="muted small">
        เข้ารหัสด้วย AES-256 ในเครื่องนี้ <strong>ถ้าลืมรหัสผ่านจะกู้ข้อมูลไม่ได้</strong> ไม่มีใครเปิดได้ รวมถึงผู้พัฒนาแอป
      </p>
    </form>
  );
}
