import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { applyRouteMeta } from "../constants/siteMeta.js";

/** Keeps document title, description, and robots in sync with the active route. */
export function DocumentMetaManager() {
  const { pathname } = useLocation();

  useEffect(() => {
    applyRouteMeta(pathname);
  }, [pathname]);

  return null;
}
