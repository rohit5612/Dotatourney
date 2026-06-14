import { PageLoadingSpinner } from "../PageLoadingSpinner.jsx";
import { usePublicTournament } from "../../context/PublicTournamentContext.jsx";

/** Shows a compact loader until the shared public tournament payload is ready. */
export function PublicEventGate({ children, label = "Loading event…" }) {
  const { ready, event } = usePublicTournament();
  if (!ready && !event) {
    return <PageLoadingSpinner label={label} compact />;
  }
  return children;
}
