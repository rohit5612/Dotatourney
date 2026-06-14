import { createContext, useContext } from "react";

const AdminTournamentContext = createContext(null);

export function AdminTournamentProvider({ value, children }) {
  return <AdminTournamentContext.Provider value={value}>{children}</AdminTournamentContext.Provider>;
}

export function useAdminTournament() {
  return useContext(AdminTournamentContext);
}
