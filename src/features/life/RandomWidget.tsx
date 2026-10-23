import { useState } from "react";
import { randomBetween, randomInt, shuffle } from "../../lib/random";
import "./life.css";

type Mode = "coin" | "dice" | "number" | "pick" | "teams";
const DICE = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

export default function RandomWidget() {
  const [mode, setMode] = useState<Mode>("coin");
  const [result, setResult] = useState<string>("");
  const [detail, setDetail] = useState<string[]>([]);
  const [diceCount, setDiceCount] = useState("2");
  const [min, setMin] = useState("1");
  const [max, setMax] = useState("100");
  const [list, setList] = useState("ส้มตำ\nข้าวมันไก่\nก๋วยเตี๋ยว\nกะเพราหมูกรอบ");
  const [teams, setTeams] = useState("2");
  const [error, setError] = useState<string | null>(null);

  const entries = list
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const run = () => {
    setError(null);
    setDetail([]);
    if (mode === "coin") setResult(randomInt(2) === 0 ? "หัว 🪙" : "ก้อย 🪙");
    if (mode === "dice") {
      const n = Number(diceCount);
      if (!Number.isInteger(n) || n < 1 || n > 10) return setError("จำนวนลูกเต๋า 1–10");
      const rolls = Array.from({ length: n }, () => randomInt(6));
      setResult(rolls.map((r) => DICE[r]).join(" "));
      setDetail([`รวม ${rolls.reduce((s, r) => s + r + 1, 0)}`]);
    }
    if (mode === "number") {
      const lo = Number(min);
      const hi = Number(max);
      if (!Number.isSafeInteger(lo) || !Number.isSafeInteger(hi) || lo > hi || hi - lo >= 2 ** 32) return setError("ช่วงตัวเลขไม่ถูกต้อง");
      setResult(String(randomBetween(lo, hi)));
    }
    if (mode === "pick") {
      if (entries.length < 2) return setError("ใส่ตัวเลือกอย่างน้อย 2 บรรทัด");
      setResult(entries[randomInt(entries.length)] as string);
    }
    if (mode === "teams") {
      const n = Number(teams);
      if (!Number.isInteger(n) || n < 2 || n > entries.length) return setError("จำนวนทีมต้องอยู่ระหว่าง 2 ถึงจำนวนรายชื่อ");
      const groups: string[][] = Array.from({ length: n }, () => []);
      shuffle(entries).forEach((name, i) => groups[i % n]?.push(name));
      setResult(`แบ่ง ${n} ทีม`);
      setDetail(groups.map((g, i) => `ทีม ${i + 1}: ${g.join(", ")}`));
    }
  };

  return (
    <div className="stack">
      <label className="field">
        สุ่มแบบ
        <select
          className="input"
          value={mode}
          onChange={(e) => {
            setMode(e.target.value as Mode);
            setResult("");
            setDetail([]);
            setError(null);
          }}
        >
          <option value="coin">โยนเหรียญ</option>
          <option value="dice">ทอยลูกเต๋า</option>
          <option value="number">สุ่มตัวเลข</option>
          <option value="pick">สุ่มเลือกจากรายการ</option>
          <option value="teams">แบ่งทีม</option>
        </select>
      </label>
      {mode === "dice" && (
        <label className="field">
          จำนวนลูกเต๋า
          <input className="input" type="number" min={1} max={10} value={diceCount} onChange={(e) => setDiceCount(e.target.value)} />
        </label>
      )}
      {mode === "number" && (
        <div className="field-row">
          <label className="field">
            ตั้งแต่
            <input className="input" type="number" value={min} onChange={(e) => setMin(e.target.value)} />
          </label>
          <label className="field">
            ถึง
            <input className="input" type="number" value={max} onChange={(e) => setMax(e.target.value)} />
          </label>
        </div>
      )}
      {(mode === "pick" || mode === "teams") && (
        <label className="field">
          {mode === "pick" ? "ตัวเลือก (บรรทัดละ 1 รายการ)" : "รายชื่อ (บรรทัดละ 1 คน)"}
          <textarea className="input" rows={5} value={list} onChange={(e) => setList(e.target.value)} />
        </label>
      )}
      {mode === "teams" && (
        <label className="field">
          จำนวนทีม
          <input className="input" type="number" min={2} value={teams} onChange={(e) => setTeams(e.target.value)} />
        </label>
      )}
      <button type="button" className="btn btn-primary" onClick={run}>
        สุ่ม!
      </button>
      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : (
        <div role="status" aria-live="polite">
          <p className="random-result">{result}</p>
          {detail.map((line) => (
            <p key={line} className="muted" style={{ margin: 0, textAlign: "center" }}>
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
