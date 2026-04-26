export function getInitialDarkMode() {
  try {
    const storedTheme = window.localStorage.getItem("theme");
    if (storedTheme) {
      return storedTheme === "dark";
    }
  } catch {
    // Ignore storage access issues and fall back.
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
}

export function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
