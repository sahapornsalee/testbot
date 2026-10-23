import { useEffect, useState, type RefObject } from "react";

/** Tracks an element's width; falls back to the window width without ResizeObserver. */
export function useElementWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(() => (typeof window === "undefined" ? 1024 : window.innerWidth));
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (typeof ResizeObserver === "undefined") {
      const onResize = () => setWidth(window.innerWidth);
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}
