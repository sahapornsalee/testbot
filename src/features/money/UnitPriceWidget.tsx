import { useState } from "react";
import { Plus, X } from "lucide-react";
import { parseNumber } from "../converter/units";
import { compareUnitPrices } from "./unitPrice";
import "./money.css";

interface Row {
  key: number;
  label: string;
  price: string;
  quantity: string;
}

let nextKey = 3;

export default function UnitPriceWidget() {
  const [unit, setUnit] = useState("มล.");
  const [rows, setRows] = useState<Row[]>([
    { key: 1, label: "ขวดเล็ก", price: "25", quantity: "500" },
    { key: 2, label: "ขวดใหญ่", price: "89", quantity: "2000" },
  ]);
  const results = compareUnitPrices(rows.map((r) => ({ label: r.label, price: parseNumber(r.price), quantity: parseNumber(r.quantity) })));
  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <div className="stack">
      <label className="field inline-field">
        หน่วย
        <input className="input" style={{ width: 100 }} value={unit} onChange={(e) => setUnit(e.target.value)} />
      </label>
      <ul className="stack" style={{ margin: 0, padding: 0, listStyle: "none" }} aria-label="สินค้าที่เปรียบเทียบ">
        {rows.map((row, i) => {
          const r = results[i];
          return (
            <li key={row.key} className={`price-row ${r?.cheapest ? "cheapest" : ""}`}>
              <input className="input" aria-label={`ชื่อสินค้า ${i + 1}`} value={row.label} onChange={(e) => update(row.key, { label: e.target.value })} />
              <input className="input" aria-label={`ราคา ${i + 1}`} inputMode="decimal" placeholder="ราคา" value={row.price} onChange={(e) => update(row.key, { price: e.target.value })} />
              <input className="input" aria-label={`ปริมาณ ${i + 1}`} inputMode="decimal" placeholder={`ปริมาณ (${unit})`} value={row.quantity} onChange={(e) => update(row.key, { quantity: e.target.value })} />
              <button type="button" className="icon-btn small-btn danger" aria-label={`ลบรายการ ${i + 1}`} disabled={rows.length <= 1} onClick={() => setRows((rs) => rs.filter((x) => x.key !== row.key))}>
                <X aria-hidden="true" size={16} />
              </button>
              <span className="small muted" style={{ gridColumn: "1 / -1" }}>
                {r?.unitPrice == null
                  ? "ใส่ราคาและปริมาณ"
                  : `${r.unitPrice.toLocaleString("th-TH", { maximumFractionDigits: 4 })} บาท/${unit}${r.cheapest ? " · ถูกที่สุด ✓" : r.extraPercent ? ` · แพงกว่า ${r.extraPercent}%` : ""}`}
              </span>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        className="btn small"
        disabled={rows.length >= 10}
        onClick={() => setRows((rs) => [...rs, { key: nextKey++, label: `สินค้า ${rs.length + 1}`, price: "", quantity: "" }])}
      >
        <Plus aria-hidden="true" size={16} /> เพิ่มสินค้า
      </button>
    </div>
  );
}
