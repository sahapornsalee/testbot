import { useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { usePersistentState } from "../../hooks/usePersistentState";
import { addCounter, changeCounter, COUNTERS_KEY, DEFAULT_COUNTERS, MAX_COUNTERS, parseCounters, removeCounter, resetCounter } from "./counters";
import "./life.css";

export default function CounterWidget() {
  const [data, setData] = usePersistentState(COUNTERS_KEY, parseCounters, DEFAULT_COUNTERS);
  const [name, setName] = useState("");
  const [step, setStep] = useState("1");

  return (
    <div className="stack">
      <ul className="counter-list" aria-label="ตัวนับ">
        {data.counters.map((c) => (
          <li key={c.id} className="counter-item">
            <div>
              <div className="small muted">
                {c.name}
                {c.step > 1 ? ` (ทีละ ${c.step})` : ""}
              </div>
              <div className="counter-value" aria-live="polite" aria-label={`${c.name} ${c.value}`}>
                {c.value.toLocaleString("th-TH")}
              </div>
            </div>
            <div className="counter-buttons">
              <button type="button" className="btn" aria-label={`ลด ${c.name}`} onClick={() => setData((d) => changeCounter(d, c.id, -1))}>
                −
              </button>
              <button type="button" className="btn btn-primary" aria-label={`เพิ่ม ${c.name}`} onClick={() => setData((d) => changeCounter(d, c.id, 1))}>
                +
              </button>
              <div style={{ display: "grid" }}>
                <button type="button" className="icon-btn small-btn" aria-label={`รีเซ็ต ${c.name}`} onClick={() => setData((d) => resetCounter(d, c.id))}>
                  <RotateCcw aria-hidden="true" size={14} />
                </button>
                <button type="button" className="icon-btn small-btn danger" aria-label={`ลบ ${c.name}`} onClick={() => setData((d) => removeCounter(d, c.id))}>
                  <Trash2 aria-hidden="true" size={14} />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <form
        className="tasks-add"
        onSubmit={(event) => {
          event.preventDefault();
          setData((d) => addCounter(d, name, Number(step)));
          setName("");
        }}
      >
        <input className="input" aria-label="ชื่อตัวนับใหม่" placeholder="ชื่อตัวนับ เช่น นับรอบวิ่ง" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input" aria-label="นับทีละ" type="number" min={1} max={1000} style={{ width: 80, flex: "none" }} value={step} onChange={(e) => setStep(e.target.value)} />
        <button type="submit" className="btn" disabled={data.counters.length >= MAX_COUNTERS}>
          เพิ่ม
        </button>
      </form>
    </div>
  );
}
