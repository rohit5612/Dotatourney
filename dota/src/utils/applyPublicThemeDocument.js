const EMERALD_ENABLED = import.meta.env.VITE_EMERALD_THEME === "true";

/** Apply public theme class tokens before React paints (avoids theme FOUC). */
export function applyPublicThemeDocument() {
  const root = document.documentElement;
  if (EMERALD_ENABLED) {
    root.classList.remove("dark");
    root.setAttribute("data-season", "emerald");
  } else {
    root.classList.add("dark");
    root.removeAttribute("data-season");
  }
}

export function isEmeraldThemeEnabled() {
  return EMERALD_ENABLED;
}
