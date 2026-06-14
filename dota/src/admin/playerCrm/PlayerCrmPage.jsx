import { useEffect, useMemo, useState } from "react";
import { PrimaryViewTabs } from "../../components/navigation/TournamentTabs.jsx";
import { AdminGlassPanel } from "../components/AdminGlassPanel.jsx";
import { AdminTournamentBanner } from "../components/AdminTournamentBanner.jsx";
import { useAdminAccess } from "../context/AdminAccessContext.jsx";
import { PlayerAccountsCrmPage } from "../players/PlayerAccountsCrmPage.jsx";
import { RegistrationCrmPage } from "../registrations/RegistrationCrmPage.jsx";
import { SubstituteCrmPage } from "../substitutes/SubstituteCrmPage.jsx";

const CRM_SUB_TABS = [
  { id: "accounts", label: "Player accounts", resource: "playerCrm.accounts" },
  { id: "registrations", label: "Registrations", resource: "playerCrm.registrations" },
  { id: "substitutes", label: "Substitutes", resource: "playerCrm.substitutes" },
];

export function PlayerCrmPage({ tournamentId, registrations, refreshRegistrations, setMessage }) {
  const access = useAdminAccess();
  const allowedTabs = useMemo(
    () => CRM_SUB_TABS.filter((tab) => access.canRead(tab.resource)),
    [access],
  );
  const [subTab, setSubTab] = useState(allowedTabs[0]?.id || "accounts");

  useEffect(() => {
    if (!allowedTabs.length) return;
    if (!allowedTabs.some((tab) => tab.id === subTab)) {
      setSubTab(allowedTabs[0].id);
    }
  }, [allowedTabs, subTab]);

  const tournamentScoped = subTab === "registrations" || subTab === "substitutes";

  if (!allowedTabs.length) {
    return (
      <AdminGlassPanel>
        <p className="text-sm text-muted-foreground">You do not have read access to any Player CRM section.</p>
      </AdminGlassPanel>
    );
  }

  return (
    <div className="admin-page-stack">
      <AdminGlassPanel subtle className="space-y-3">
        <div>
          <h2 className="admin-section-title">Player CRM</h2>
          <p className="text-sm text-muted-foreground">BPC accounts, tournament registrations, and substitute pool.</p>
        </div>
        {allowedTabs.length > 1 ? (
          <PrimaryViewTabs
            value={subTab}
            onChange={setSubTab}
            tabs={allowedTabs.map(({ id, label }) => ({ id, label }))}
            ariaLabel="Player CRM sections"
          />
        ) : null}
      </AdminGlassPanel>

      {tournamentScoped ? <AdminTournamentBanner showSelector /> : null}

      {subTab === "accounts" ? (
        <PlayerAccountsCrmPage
          setMessage={setMessage}
          canWrite={access.canUpdate("playerCrm.accounts")}
        />
      ) : null}
      {subTab === "registrations" ? (
        tournamentId ? (
          <RegistrationCrmPage
            tournamentId={tournamentId}
            registrations={registrations}
            refreshRegistrations={refreshRegistrations}
            canWrite={access.canUpdate("playerCrm.registrations")}
            canDelete={access.canDelete("playerCrm.registrations")}
          />
        ) : (
          <AdminGlassPanel>
            <p className="text-sm text-muted-foreground">Select a tournament in Setup to manage registrations.</p>
          </AdminGlassPanel>
        )
      ) : null}
      {subTab === "substitutes" ? (
        <SubstituteCrmPage
          tournamentId={tournamentId}
          setMessage={setMessage}
          canWrite={access.canUpdate("playerCrm.substitutes")}
        />
      ) : null}
    </div>
  );
}
