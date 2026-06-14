import { useEffect } from "react";
import { applyPublicThemeDocument, isEmeraldThemeEnabled } from "../utils/applyPublicThemeDocument.js";

/**
 * Public site theme: dark by default during build phases; emerald light when VITE_EMERALD_THEME=true.
 */
export function usePublicTheme() {
  useEffect(() => {
    applyPublicThemeDocument();
  }, []);
}

export { isEmeraldThemeEnabled };
