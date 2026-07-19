import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { peekCache } from "../lib/requestCache.js";
import { resolveBlastBracketMatches } from "../utils/blastSeeding.js";
import { collectTeamLogoUrls, preloadTeamLogos } from "../utils/teamLogoCache.js";

export const PublicTournamentContext = createContext(null);

export function PublicTournamentProvider({ children }) {
  const [event, setEvent] = useState(() => peekCache("public:tournament") ?? null);
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(() => peekCache("public:tournament") != null);

  useEffect(() => {
    let active = true;

    const load = () =>
      api
        .getPublicTournamentFresh()
        .then((payload) => {
          if (!active) return;
          setEvent(payload);
        })
        .catch((error) => {
          if (active) setMessage(error.message);
        })
        .finally(() => {
          if (active) setReady(true);
        });

    load();
    const poll = window.setInterval(load, 30_000);

    function refreshOnVisible() {
      if (document.visibilityState === "visible") load();
    }
    document.addEventListener("visibilitychange", refreshOnVisible);

    return () => {
      active = false;
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", refreshOnVisible);
    };
  }, []);

  const displayEvent = useMemo(() => {
    if (!event) return event;
    const format = event.tournament?.format;
    const matches = resolveBlastBracketMatches(
      event.matches || [],
      event.groupedStandings || [],
      format,
      event.tournament?.engine_config,
    );
    return { ...event, matches };
  }, [event]);

  const tournamentSlug = event?.tournament?.slug || "bpcl";

  useEffect(() => {
    const urls = collectTeamLogoUrls(event?.teams, event?.setupTeams);
    if (urls.length) void preloadTeamLogos(urls);
  }, [event?.teams, event?.setupTeams]);

  return (
    <PublicTournamentContext.Provider
      value={{ event, displayEvent, message, setMessage, ready, tournamentSlug }}
    >
      {children}
    </PublicTournamentContext.Provider>
  );
}

export function usePublicTournament() {
  const ctx = useContext(PublicTournamentContext);
  if (!ctx) throw new Error("usePublicTournament must be used within PublicTournamentProvider");
  return ctx;
}
