import { hrefFor } from "../app/router";

export function NotFound() {
  return (
    <div className="card" style={{ padding: "var(--space-6)" }}>
      <h1 className="page-title">ไม่พบหน้านี้</h1>
      <p className="page-subtitle">ลิงก์อาจไม่ถูกต้อง หรือเครื่องมือนี้ถูกนำออกแล้ว</p>
      <a className="btn btn-primary" href={hrefFor({ name: "dashboard" })}>
        กลับไปหน้า Dashboard
      </a>
    </div>
  );
}
