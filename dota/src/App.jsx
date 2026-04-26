import { useEffect, useMemo, useState } from "react";
import { AdminAuthPage } from "./pages/AdminAuthPage";
import { AdminUsersPage } from "./pages/AdminUsersPage";
import { AppHeader } from "./components/AppHeader";
import { buildDefaultSeriesRules, pages, roles } from "./constants/tournament";
import { api, getAuthToken, setAuthToken } from "./lib/api";
import { BracketPage } from "./pages/BracketPage";
import { PublicApp } from "./pages/PublicPages";
import { RegistrationCrmPage } from "./pages/RegistrationCrmPage";
import { SchedulePage } from "./pages/SchedulePage";
import { SetupPage } from "./pages/SetupPage";
import { StandingsPage } from "./pages/StandingsPage";
import { TeamsPage } from "./pages/TeamsPage";
import { createId } from "./utils/client";

function App() {
  const [path, setPath] = useState(() => window.location.pathname);
  const [activePage, setActivePage] = useState("setup");
  const [tournamentId, setTournamentId] = useState("");
  const [state, setState] = useState(null);
  const [activeTab, setActiveTab] = useState("upper");
  const [selectedFormat, setSelectedFormat] = useState("dse");
  const [setup, setSetup] = useState({
    name: "The Dota 2 Cup",
    format: "dse",
    seriesType: "bo3",
    teamCount: 8,
    seriesRules: buildDefaultSeriesRules("dse", "bo3"),
    slug: "the-forge",
    description: "",
    prizePool: "",
    startDate: "",
    endDate: "",
    registrationDeadline: "",
    discordUrl: "",
    rulebook: "",
    announcements: [],
    visibilityMode: "demo",
  });
  const [teamDraft, setTeamDraft] = useState([]);
  const [poolDraft, setPoolDraft] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [adminUser, setAdminUser] = useState(null);
  const [newCaptain, setNewCaptain] = useState({ captain: "", team: "" });
  const [newPlayer, setNewPlayer] = useState({ name: "", role: "Carry" });
  const [message, setMessage] = useState("");

  function navigate(nextPath) {
    window.history.pushState({}, "", nextPath);
    setPath(nextPath);
  }

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  useEffect(() => {
    async function loadAdmin() {
      if (!path.startsWith("/admin") || !getAuthToken()) return;
      try {
        const payload = await api.getAdminMe();
        setAdminUser(payload.user);
      } catch {
        setAuthToken("");
        setAdminUser(null);
      }
    }
    loadAdmin();
  }, [path]);

  async function refreshTournament(id = tournamentId) {
    if (!id) return;
    const payload = await api.getTournament(id);
    setState(payload);
    if (payload.tournament) {
      setSetup((prev) => ({
        ...prev,
        name: payload.tournament.name ?? prev.name,
        slug: payload.tournament.slug ?? prev.slug,
        format: payload.tournament.format ?? prev.format,
        seriesType: payload.tournament.series_type ?? prev.seriesType,
        teamCount: payload.tournament.team_count ?? prev.teamCount,
        seriesRules:
          payload.tournament.series_rules && Object.keys(payload.tournament.series_rules).length > 0
            ? payload.tournament.series_rules
            : prev.seriesRules,
        description: payload.tournament.description ?? prev.description,
        prizePool: payload.tournament.prize_pool ?? prev.prizePool,
        startDate: payload.tournament.start_date ? String(payload.tournament.start_date).slice(0, 10) : prev.startDate,
        endDate: payload.tournament.end_date ? String(payload.tournament.end_date).slice(0, 10) : prev.endDate,
        registrationDeadline: payload.tournament.registration_deadline
          ? String(payload.tournament.registration_deadline).slice(0, 16)
          : prev.registrationDeadline,
        discordUrl: payload.tournament.discord_url ?? prev.discordUrl,
        rulebook: payload.tournament.rulebook ?? prev.rulebook,
        announcements: payload.tournament.announcements ?? prev.announcements,
        visibilityMode: payload.tournament.visibility_mode ?? prev.visibilityMode,
      }));
      setTournamentId(payload.tournament.id);
    }
    setTeamDraft(payload.teams || []);
    const linkedPlayers = (payload.players || []).map((player) => ({
      ...player,
      role: player.role || player.roles?.[0] || roles[0],
      teamId: payload.teamPlayers?.find((record) => record.player_id === player.id)?.team_id || null,
    }));
    setPoolDraft(linkedPlayers);
    if (payload.tabs?.[0]?.id) {
      setActiveTab(payload.tabs[0].id);
    }
    await refreshRegistrations(payload.tournament?.id || id);
  }

  async function refreshRegistrations(id = tournamentId) {
    if (!id) return;
    const payload = await api.getRegistrations(id);
    setRegistrations(payload.registrations);
  }

  async function bootstrapTournament() {
    const payload = {
      ...setup,
      teamCount: Number(setup.teamCount),
      darkMode: true,
    };
    if (!tournamentId) {
      const response = await api.createTournament(payload);
      setTournamentId(response.tournament.id);
      setMessage("Tournament created.");
      await refreshTournament(response.tournament.id);
      setSelectedFormat(payload.format);
      return;
    }
    await api.updateTournament(tournamentId, payload);
    await refreshTournament(tournamentId);
    setMessage("Tournament updated.");
  }

  async function generateBracket() {
    if (!tournamentId) {
      setMessage("Create tournament first.");
      return;
    }
    await api.generateMatches(tournamentId);
    await refreshTournament();
    setActivePage("bracket");
    setMessage("Bracket generated.");
  }

  function addCaptain() {
    if (!newCaptain.captain.trim()) return;
    const team = {
      id: createId(),
      name: newCaptain.team.trim() || `${newCaptain.captain.trim()}'s Team`,
      captain: newCaptain.captain.trim(),
      abbr: (newCaptain.team || newCaptain.captain)
        .split(" ")
        .map((word) => word[0] || "")
        .join("")
        .slice(0, 3)
        .toUpperCase(),
      seed: teamDraft.length + 1,
    };
    setTeamDraft((prev) => [...prev, team]);
    setNewCaptain({ captain: "", team: "" });
  }

  function addPoolPlayer() {
    if (!newPlayer.name.trim()) return;
    setPoolDraft((prev) => [
      ...prev,
      { id: createId(), name: newPlayer.name.trim(), role: newPlayer.role, roles: [newPlayer.role], teamId: null },
    ]);
    setNewPlayer((prev) => ({ ...prev, name: "" }));
  }

  function addRegistrationPlayer(registration) {
    setPoolDraft((prev) => [
      ...prev,
      {
        id: createId(),
        registrationId: registration.id,
        name: registration.name,
        role: registration.roles?.[0] || roles[0],
        roles: registration.roles || [],
        mmr: registration.mmr,
        steamName: registration.steamName,
        steamProfile: registration.steamProfile,
        discordHandle: registration.discordHandle,
        location: registration.location,
        teamId: null,
        isCaptain: false,
      },
    ]);
  }

  function assignPlayer(playerId, teamId) {
    setPoolDraft((prev) => prev.map((player) => (player.id === playerId ? { ...player, teamId } : player)));
  }

  function markCaptain(playerId, isCaptain) {
    setPoolDraft((prev) => prev.map((player) => (player.id === playerId ? { ...player, isCaptain } : player)));
  }

  function autoAssign() {
    if (!teamDraft.length) return;
    const roleBuckets = {};
    roles.forEach((role) => {
      roleBuckets[role] = poolDraft.filter((player) => !player.teamId && player.role === role);
    });
    const next = [...poolDraft];
    teamDraft.forEach((team) => {
      roles.forEach((role) => {
        const picked = roleBuckets[role].find((player) => !player.teamId);
        if (picked) {
          const item = next.find((x) => x.id === picked.id);
          if (item) item.teamId = team.id;
          picked.teamId = team.id;
        }
      });
    });
    setPoolDraft(next);
  }

  async function saveTeams() {
    if (!tournamentId) {
      setMessage("Create tournament first.");
      return;
    }
    await api.saveTeams(tournamentId, { teams: teamDraft, players: poolDraft });
    await refreshTournament();
    setMessage("Teams saved.");
  }

  async function submitResult(matchId, winner) {
    await api.recordResult(tournamentId, matchId, winner);
    await refreshTournament();
  }

  async function updateMatch(matchId, payload) {
    await api.updateMatch(tournamentId, matchId, payload);
    await refreshTournament();
  }

  async function saveSchedule() {
    if (!state?.matches?.length) return;
    const schedule = state.matches.slice(0, 10).map((match, index) => ({
      id: createId(),
      matchId: match.id,
      startAt: new Date(Date.now() + index * 3600_000).toISOString(),
      stream: index % 2 === 0 ? "Main" : "Secondary",
      status: index === 0 ? "live" : "upcoming",
      notes: "",
    }));
    await api.saveSchedule(tournamentId, schedule);
    await refreshTournament();
    setMessage("Schedule generated and saved.");
  }

  async function saveCustomSchedule(schedule) {
    if (!tournamentId) return;
    await api.saveSchedule(tournamentId, schedule);
    await refreshTournament();
    setMessage("Schedule edits saved.");
  }

  async function exportData() {
    if (!tournamentId) return;
    const payload = await api.exportTournament(tournamentId);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `tournament-${tournamentId}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importData(event) {
    const file = event.target.files?.[0];
    if (!file || !tournamentId) return;
    const text = await file.text();
    const parsed = JSON.parse(text);
    await api.importTournament(tournamentId, parsed.data);
    await refreshTournament();
    setMessage("Import completed.");
  }

  const groupedMatches = useMemo(() => {
    const groups = {};
    (state?.matches || []).forEach((match) => {
      if (!groups[match.stageKey]) groups[match.stageKey] = [];
      groups[match.stageKey].push(match);
    });
    return groups;
  }, [state]);

  async function logout() {
    await api.logoutAdmin().catch(() => {});
    setAuthToken("");
    setAdminUser(null);
    navigate("/");
  }

  if (!path.startsWith("/admin")) {
    return <PublicApp path={path} navigate={navigate} />;
  }

  const inviteToken = path.startsWith("/admin/invite/") ? path.split("/").pop() : "";

  if (!adminUser) {
    return <AdminAuthPage inviteToken={inviteToken} onAuthed={setAdminUser} />;
  }

  const adminPages = [...pages, "registrations", "users"];

  return (
    <main className="min-h-screen bg-background text-foreground">
      <AppHeader pages={adminPages} activePage={activePage} setActivePage={setActivePage} />

      <section className="mx-auto max-w-6xl space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-3 text-sm">
          <div>
            Signed in as <span className="font-medium">{adminUser.name}</span> ({adminUser.role})
          </div>
          <div className="flex gap-2">
            <button type="button" className="rounded-md border border-border px-3 py-1" onClick={() => navigate("/")}>
              View public site
            </button>
            <button type="button" className="rounded-md border border-border px-3 py-1" onClick={logout}>
              Logout
            </button>
          </div>
        </div>
        {message ? <p className="rounded-md border border-border bg-card p-2 text-sm text-secondary">{message}</p> : null}

        {activePage === "setup" && (
          <SetupPage
            setup={setup}
            setSetup={setSetup}
            selectedFormat={selectedFormat}
            onFormatChange={(nextFormat) => {
              setSelectedFormat(nextFormat);
              setSetup((prev) => ({
                ...prev,
                format: nextFormat,
                seriesRules: buildDefaultSeriesRules(nextFormat, prev.seriesType),
              }));
            }}
            bootstrapTournament={bootstrapTournament}
            generateBracket={generateBracket}
            exportData={exportData}
            importData={importData}
            state={state}
          />
        )}

        {activePage === "teams" && (
          <TeamsPage
            teamDraft={teamDraft}
            poolDraft={poolDraft}
            newCaptain={newCaptain}
            setNewCaptain={setNewCaptain}
            newPlayer={newPlayer}
            setNewPlayer={setNewPlayer}
            addCaptain={addCaptain}
            addPoolPlayer={addPoolPlayer}
            assignPlayer={assignPlayer}
            autoAssign={autoAssign}
            saveTeams={saveTeams}
            registrations={registrations}
            addRegistrationPlayer={addRegistrationPlayer}
            markCaptain={markCaptain}
          />
        )}

        {activePage === "bracket" && (
          <BracketPage
            state={state}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            groupedMatches={groupedMatches}
            submitResult={submitResult}
            updateMatch={updateMatch}
          />
        )}

        {activePage === "standings" && <StandingsPage standings={state?.standings} />}

        {activePage === "schedule" && <SchedulePage state={state} saveSchedule={saveSchedule} saveCustomSchedule={saveCustomSchedule} />}

        {activePage === "registrations" && (
          <RegistrationCrmPage
            tournamentId={tournamentId}
            registrations={registrations}
            refreshRegistrations={() => refreshRegistrations(tournamentId)}
          />
        )}

        {activePage === "users" && <AdminUsersPage currentUser={adminUser} />}
      </section>
    </main>
  );
}

export default App;
