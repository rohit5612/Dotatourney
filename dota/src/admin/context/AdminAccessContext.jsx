import { createContext, useContext, useMemo } from "react";
import { buildAdminAccess } from "../../lib/adminRbac.js";

const AdminAccessContext = createContext(null);

export function AdminAccessProvider({ user, children }) {
  const value = useMemo(() => buildAdminAccess(user), [user]);
  return <AdminAccessContext.Provider value={value}>{children}</AdminAccessContext.Provider>;
}

export function useAdminAccess() {
  const ctx = useContext(AdminAccessContext);
  if (!ctx) {
    return buildAdminAccess(null);
  }
  return ctx;
}
