import { useEffect, useState, useSyncExternalStore } from "react";
import { RefreshCw, WifiOff } from "lucide-react";
import { applyUpdate, onUpdateAvailable } from "../app/pwa";

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}

export function AppBanners() {
  const online = useOnline();
  const [updateReady, setUpdateReady] = useState(false);
  useEffect(() => onUpdateAvailable((worker) => setUpdateReady(worker !== null)), []);

  return (
    <>
      {!online && (
        <p className="notice app-banner" role="status">
          <WifiOff aria-hidden="true" size={18} /> ออฟไลน์อยู่ — เครื่องมือทั้งหมดยังใช้งานได้ และข้อมูลบันทึกในเครื่องตามปกติ
        </p>
      )}
      {updateReady && (
        <div className="notice app-banner update-banner" role="status">
          <span>มีเวอร์ชันใหม่ของ Productivity Hub</span>
          <button type="button" className="btn small" onClick={applyUpdate}>
            <RefreshCw aria-hidden="true" size={16} /> อัปเดตตอนนี้
          </button>
        </div>
      )}
    </>
  );
}
