/**
 * Passes text from one tool to another (e.g. file → splitter) for the
 * current tab only. Read once, then cleared.
 */
const PREFIX = "productivity-hub:handoff:";

export function sendTo(toolId: string, text: string): void {
  try {
    sessionStorage.setItem(PREFIX + toolId, text);
  } catch {
    // Storage unavailable: the user can still copy and paste.
  }
  window.location.hash = `#/tools/${toolId}`;
}

export function takeHandoff(toolId: string): string | null {
  try {
    const value = sessionStorage.getItem(PREFIX + toolId);
    if (value !== null) sessionStorage.removeItem(PREFIX + toolId);
    return value;
  } catch {
    return null;
  }
}
