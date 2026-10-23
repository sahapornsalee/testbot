import { useEffect, useState } from "react";

/**
 * Hash-based routes (#/tools/calculator). GitHub Pages has no server-side
 * rewrites, so hash routes keep refresh and direct links working.
 */
export type Route =
  | { name: "dashboard" }
  | { name: "tool"; id: string }
  | { name: "settings" }
  | { name: "not-found"; path: string };

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, "").replace(/\/+$/, "") || "/";
  if (path === "/") return { name: "dashboard" };
  if (path === "/settings") return { name: "settings" };
  const tool = /^\/tools\/([a-z0-9-]+)$/.exec(path);
  if (tool?.[1]) return { name: "tool", id: tool[1] };
  return { name: "not-found", path };
}

export function hrefFor(route: Route): string {
  switch (route.name) {
    case "dashboard":
      return "#/";
    case "settings":
      return "#/settings";
    case "tool":
      return `#/tools/${route.id}`;
    case "not-found":
      return `#${route.path}`;
  }
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}
