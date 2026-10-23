/** Service worker registration with a user-confirmed update flow. */

type Listener = (waiting: ServiceWorker | null) => void;
const listeners = new Set<Listener>();
let waitingWorker: ServiceWorker | null = null;
let updateRequested = false;

function setWaiting(worker: ServiceWorker | null) {
  waitingWorker = worker;
  listeners.forEach((listener) => listener(worker));
}

export function onUpdateAvailable(listener: Listener): () => void {
  listeners.add(listener);
  listener(waitingWorker);
  return () => listeners.delete(listener);
}

/** Activates the waiting version; the page reloads once it takes control. */
export function applyUpdate(): void {
  if (!waitingWorker) return;
  updateRequested = true;
  waitingWorker.postMessage("SKIP_WAITING");
}

export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator) || !window.isSecureContext) return;
  const base = import.meta.env.BASE_URL;
  // Reload only when the user asked for the update. On a first visit the new
  // worker also takes control (clients.claim), and reloading then would throw
  // away whatever the user was doing.
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!updateRequested) return;
    updateRequested = false;
    window.location.reload();
  });
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`${base}sw.js`, { scope: base })
      .then((registration) => {
        // Only offer an update when an older version is already in control.
        if (registration.waiting && navigator.serviceWorker.controller) setWaiting(registration.waiting);
        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          installing?.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) setWaiting(installing);
          });
        });
        // Check for a new deploy when the user returns to the tab.
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") void registration.update().catch(() => {});
        });
      })
      .catch(() => {
        // Offline support is optional; the app works without it.
      });
  });
}
