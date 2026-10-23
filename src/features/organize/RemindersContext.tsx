import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { BellRing } from "lucide-react";
import { usePersistentState } from "../../hooks/usePersistentState";
import { playBeep } from "../../lib/sound";
import { dueReminders, EMPTY_REMINDERS, markNotified, parseReminders, REMINDERS_KEY, setDone, snooze, type Reminder, type RemindersData } from "./reminders";
import "./organize.css";

interface RemindersContextValue {
  data: RemindersData;
  update: (change: (d: RemindersData) => RemindersData) => void;
}

const RemindersContext = createContext<RemindersContextValue | null>(null);

/**
 * Holds reminders for the whole app and alerts when one is due, whichever
 * page is open. Web pages cannot alert while closed, so this only works while
 * the app is open in a tab.
 */
export function RemindersProvider({ children }: { children: ReactNode }) {
  const [data, setData] = usePersistentState(REMINDERS_KEY, parseReminders, EMPTY_REMINDERS);
  const [alerts, setAlerts] = useState<Reminder[]>([]);
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const hasPending = data.reminders.some((r) => !r.done && !r.notified);
  useEffect(() => {
    if (!hasPending) return;
    const check = () => {
      const fresh = dueReminders(dataRef.current, Date.now());
      if (fresh.length === 0) return;
      const ids = fresh.map((r) => r.id);
      dataRef.current = markNotified(dataRef.current, ids);
      setData((d) => markNotified(d, ids));
      setAlerts((a) => [...a, ...fresh]);
      playBeep(1, 740);
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        for (const r of fresh) {
          try {
            new Notification("เตือนความจำ", { body: r.title, tag: r.id });
          } catch {
            // Some browsers only allow notifications from a service worker.
          }
        }
      }
    };
    const first = window.setTimeout(check, 0);
    const id = window.setInterval(check, 15_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [hasPending, setData]);

  const current = alerts[0];
  return (
    <RemindersContext.Provider value={{ data, update: setData }}>
      {children}
      {current && (
        <div className="reminder-toast" role="alertdialog" aria-labelledby="reminder-toast-title">
          <strong id="reminder-toast-title">
            <BellRing aria-hidden="true" size={18} /> เตือนความจำ
          </strong>
          <span>{current.title}</span>
          <div className="button-row">
            <button
              type="button"
              className="btn btn-primary small"
              onClick={() => {
                setData((d) => setDone(d, current.id, true));
                setAlerts((a) => a.slice(1));
              }}
            >
              เสร็จแล้ว
            </button>
            <button
              type="button"
              className="btn small"
              onClick={() => {
                setData((d) => snooze(d, current.id, Date.now(), 10));
                setAlerts((a) => a.slice(1));
              }}
            >
              เตือนอีกครั้งใน 10 นาที
            </button>
            <button type="button" className="btn small" onClick={() => setAlerts((a) => a.slice(1))}>
              ปิด
            </button>
          </div>
        </div>
      )}
    </RemindersContext.Provider>
  );
}

export function useReminders(): RemindersContextValue {
  const value = useContext(RemindersContext);
  if (!value) throw new Error("useReminders must be used inside RemindersProvider");
  return value;
}
