import { useContext, useEffect, useMemo, useState } from "react";
import { PublicTournamentContext } from "../context/PublicTournamentContext.jsx";
import { resolvePublicNavLinks } from "../constants/publicNav.js";
import { api } from "../lib/api.js";
import { peekCache } from "../lib/requestCache.js";

/** Navbar links with conditional Teams (tournament mode + bracket generated). */
export function useSiteNavLinks() {
  const tournamentCtx = useContext(PublicTournamentContext);
  const [fallbackEvent, setFallbackEvent] = useState(() => peekCache("public:tournament") ?? null);

  useEffect(() => {
    if (tournamentCtx) return undefined;

    let active = true;
    api
      .getPublicTournament()
      .then((payload) => {
        if (active) setFallbackEvent(payload);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [tournamentCtx]);

  const event = tournamentCtx?.event ?? fallbackEvent;

  return useMemo(() => resolvePublicNavLinks(event), [event]);
}
