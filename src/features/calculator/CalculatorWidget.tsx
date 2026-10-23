import { useId, useRef, useState } from "react";
import { ERROR_MESSAGES, evaluate, formatResult, type CalculatorError } from "./engine";
import "./calculator.css";

type Key = { label: string; insert?: string; action?: "clear" | "backspace" | "equals"; aria?: string; wide?: boolean };

const KEYS: Key[] = [
  { label: "C", action: "clear", aria: "ล้างทั้งหมด" },
  { label: "(", insert: "(" },
  { label: ")", insert: ")" },
  { label: "÷", insert: "÷", aria: "หาร" },
  { label: "7", insert: "7" },
  { label: "8", insert: "8" },
  { label: "9", insert: "9" },
  { label: "×", insert: "×", aria: "คูณ" },
  { label: "4", insert: "4" },
  { label: "5", insert: "5" },
  { label: "6", insert: "6" },
  { label: "−", insert: "−", aria: "ลบ" },
  { label: "1", insert: "1" },
  { label: "2", insert: "2" },
  { label: "3", insert: "3" },
  { label: "+", insert: "+", aria: "บวก" },
  { label: "%", insert: "%", aria: "เปอร์เซ็นต์" },
  { label: "0", insert: "0" },
  { label: ".", insert: ".", aria: "จุดทศนิยม" },
  { label: "⌫", action: "backspace", aria: "ลบตัวสุดท้าย" },
  { label: "=", action: "equals", aria: "เท่ากับ", wide: true },
];

interface HistoryEntry {
  expression: string;
  result: string;
}

export default function CalculatorWidget() {
  const [expression, setExpression] = useState("");
  const [error, setError] = useState<CalculatorError | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const errorId = useId();

  const update = (next: string) => {
    setExpression(next);
    setError(null);
  };

  const calculate = () => {
    const result = evaluate(expression);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const text = formatResult(result.value);
    setHistory((prev) => [{ expression, result: text }, ...prev].slice(0, 5));
    update(text);
  };

  const press = (key: Key) => {
    if (key.action === "clear") update("");
    else if (key.action === "backspace") update(expression.slice(0, -1));
    else if (key.action === "equals") calculate();
    else if (key.insert) update(expression + key.insert);
    inputRef.current?.focus();
  };

  return (
    <div className="calculator">
      <label htmlFor={inputId} className="visually-hidden">
        นิพจน์ที่ต้องการคำนวณ
      </label>
      <input
        id={inputId}
        ref={inputRef}
        className="calculator-display"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        placeholder="0"
        value={expression}
        aria-invalid={error !== null}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => update(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === "=") {
            event.preventDefault();
            calculate();
          } else if (event.key === "Escape") {
            update("");
          }
        }}
      />
      <p id={errorId} className="calculator-error error-text" role="alert">
        {error ? ERROR_MESSAGES[error] : ""}
      </p>

      <div className="calculator-keys">
        {KEYS.map((key) => (
          <button
            key={key.label}
            type="button"
            className={`calculator-key ${key.action === "equals" ? "is-equals" : ""} ${
              key.insert && /[÷×−+%()]/.test(key.insert) ? "is-operator" : ""
            } ${key.wide ? "is-wide" : ""}`}
            aria-label={key.aria}
            onClick={() => press(key)}
          >
            {key.label}
          </button>
        ))}
      </div>

      {history.length > 0 && (
        <section className="calculator-history" aria-label="ประวัติการคำนวณ">
          <ol>
            {history.map((entry, index) => (
              <li key={index}>
                <button type="button" className="history-item" onClick={() => update(entry.result.replace(/,/g, ""))}>
                  <span>{entry.expression} =</span> <strong>{entry.result}</strong>
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
