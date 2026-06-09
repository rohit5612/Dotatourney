import { useEffect } from "react";

const EMERALD_ENABLED = import.meta.env.VITE_EMERALD_THEME === "true";

/**
 * Public site theme: dark by default during build phases; emerald light when VITE_EMERALD_THEME=true.
 */
export function usePublicTheme() {
  useEffect(() => {
    if (EMERALD_ENABLED) {
      document.documentElement.classList.remove("dark");
      document.documentElement.setAttribute("data-season", "emerald");
      import("../styles/season-emerald.css");
    } else {
      document.documentElement.classList.add("dark");
      document.documentElement.removeAttribute("data-season");
    }
  }, []);
}

export function isEmeraldThemeEnabled() {
  return EMERALD_ENABLED;
}
