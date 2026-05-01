import { useEffect, useMemo, useState } from "react";
import { AdminAuthPage } from "./pages/AdminAuthPage";
import { AdminUsersPage } from "./pages/AdminUsersPage";
import { AppFooter } from "./components/AppFooter";
import { AppHeader } from "./components/AppHeader";
import { ScrollToTopButton } from "./components/ScrollToTopButton";
import { buildDefaultSeriesRules, roles } from "./constants/tournament";
import { api, getAuthToken, setAuthToken } from "./lib/api";
import { toDateInputValue, toDatetimeLocalValue } from "./utils/datetime";
import { AnnouncementsPage } from "./pages/AnnouncementsPage";
import { BracketPage } from "./pages/BracketPage";
import { PublicApp } from "./pages/PublicPages";
import { RegistrationCrmPage } from "./pages/RegistrationCrmPage";
import { SchedulePage } from "./pages/SchedulePage";
import { SetupPage } from "./pages/SetupPage";
import { StandingsPage } from "./pages/StandingsPage";
import { TeamsPage } from "./pages/TeamsPage";
import { createId, getInitialDarkMode } from "./utils/client";

const adminPages = ["registrations", "teams", "setup", "announcements", "bracketSchedule", "standings", "users"];

function App() {
  const [path, setPath] = useState(() => window.location.pathname);
  const [activePage, setActivePage] = useState("registrations");
  const [tournamentId, setTournamentId] = useState("");
  const [state, setState] = useState(null);
  const [activeTab, setActiveTab] = useState("upper");
  const [selectedFormat, setSelectedFormat] = useState("dse");
  const [setup, setSetup] = useState({
    name: "BPC League — Bharat Pro Circuit League",
    format: "dse",
    seriesType: "bo3",
    teamCount: 8,
    seriesRules: buildDefaultSeriesRules("dse", "bo3"),
    slug: "bpcl",
    description: "",
    prizePool: "",
    prizePoolBreakdown: [{ placement: 1, label: "1st place", amount: "" }],
    entryFee: "",
    startDate: "",
    endDate: "",
    registrationDeadline: "",
    discordUrl: "https://discord.gg/NmC2Xqnb",
    rulebook: "",
    announcements: [],
    visibilityMode: "demo",
    bracketActive: false,
    registrationCodePrefix: "BPC",
    paymentQrImage: "",
    paymentUpiId: "",
    registrationCodeSeq: 0,
  });
  const [teamDraft, setTeamDraft] = useState([]);
  const [poolDraft, setPoolDraft] = useState([]);
  const [rosters, setRosters] = useState([]);
  const [approvedRoster, setApprovedRoster] = useState(null);
  const [activeRosterId, setActiveRosterId] = useState("");
  const [isTeamPaneActive, setIsTeamPaneActive] = useState(false);
  const [registrations, setRegistrations] = useState([]);
  const [tournamentList, setTournamentList] = useState([]);
  const [adminUser, setAdminUser] = useState(null);
  const [newCaptain, setNewCaptain] = useState({ captain: "", team: "" });
  const [newPlayer, setNewPlayer] = useState({ name: "", role: "Carry" });
  const [darkMode, setDarkMode] = useState(getInitialDarkMode);
  const [message, setMessage] = useState("");

  function normalizeAnnouncements(value) {
    if (Array.isArray(value)) return value;
    if (typeof value === "string") {
      return value
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
    }
    if (value && typeof value === "object") {
      return Object.values(value)
        .map((item) => String(item || "").trim())
        .filter(Boolean);
    }
    return [];
  }

  function navigate(nextPath) {
    window.history.pushState({}, "", nextPath);
    setPath(nextPath);
  }

  function navigateAdminPage(page) {
    setActivePage(page);
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [path]);

  useEffect(() => {
    if (path.startsWith("/admin") && path !== "/admin" && !path.startsWith("/admin/invite/")) {
      window.history.replaceState({}, "", "/admin");
      setPath("/admin");
    }
  }, [path]);

  useEffect(() => {
    if (!path.startsWith("/admin")) {
      document.documentElement.classList.add("dark");
      return;
    }
    document.documentElement.classList.toggle("dark", darkMode);
    try {
      window.localStorage.setItem("theme", darkMode ? "dark" : "light");
    } catch {
      // Ignore storage write errors.
    }
  }, [darkMode, path]);

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

  useEffect(() => {
    if (adminUser && path.startsWith("/admin")) {
      loadTournaments().catch((error) => setMessage(error.message));
    }
    // Initial admin hydration only; subsequent tournament mutations refresh explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminUser, path]);

  async function loadTournaments() {
    const payload = await api.getTournaments();
    setTournamentList(payload.tournaments || []);
    const published = payload.tournaments?.find((tournament) => tournament.is_published);
    const nextId = tournamentId || published?.id || payload.tournaments?.[0]?.id;
    if (nextId && nextId !== tournamentId) {
      await refreshTournament(nextId);
    }
  }

  async function refreshTournament(id = tournamentId, options = {}) {
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
        prizePoolBreakdown: payload.tournament.prize_pool_breakdown ?? prev.prizePoolBreakdown,
        entryFee: payload.tournament.entry_fee ?? prev.entryFee,
        startDate: payload.tournament.start_date ? toDateInputValue(payload.tournament.start_date) : prev.startDate,
        endDate: payload.tournament.end_date ? toDateInputValue(payload.tournament.end_date) : prev.endDate,
        registrationDeadline: payload.tournament.registration_deadline
          ? toDatetimeLocalValue(payload.tournament.registration_deadline)
          : prev.registrationDeadline,
        discordUrl: payload.tournament.discord_url ?? prev.discordUrl,
        rulebook: payload.tournament.rulebook ?? prev.rulebook,
        announcements: payload.tournament.announcements ?? prev.announcements,
        visibilityMode: payload.tournament.visibility_mode ?? prev.visibilityMode,
        bracketActive: payload.tournament.bracket_active ?? prev.bracketActive,
        registrationCodePrefix: payload.tournament.registration_code_prefix ?? prev.registrationCodePrefix ?? "BPC",
        paymentQrImage: payload.tournament.payment_qr_image ?? prev.paymentQrImage ?? "",
        paymentUpiId: payload.tournament.payment_upi_id ?? prev.paymentUpiId ?? "",
        registrationCodeSeq: payload.tournament.registration_code_seq ?? prev.registrationCodeSeq ?? 0,
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
    setApprovedRoster(payload.approvedRoster || null);
    if (!options.keepTeamPane) {
      setActiveRosterId("");
      setIsTeamPaneActive(false);
    }
    if (payload.tabs?.[0]?.id) {
      setActiveTab(payload.tabs[0].id);
    }
    await refreshRegistrations(payload.tournament?.id || id);
    await refreshRosters(payload.tournament?.id || id);
  }

  async function refreshRegistrations(id = tournamentId) {
    if (!id) return;
    const payload = await api.getRegistrations(id);
    setRegistrations(payload.registrations);
  }

  async function refreshRosters(id = tournamentId) {
    if (!id) {
      setRosters([]);
      setApprovedRoster(null);
      return;
    }
    const payload = await api.getRosters(id);
    setRosters(payload.rosters || []);
    setApprovedRoster(payload.approvedRoster || null);
  }

  function buildTournamentPayload(overrides = {}) {
    return {
      ...setup,
      ...overrides,
      teamCount: Number(setup.teamCount),
      darkMode: true,
      announcements: normalizeAnnouncements(overrides.announcements ?? setup.announcements),
    };
  }

  async function bootstrapTournament() {
    const payload = buildTournamentPayload();
    if (!tournamentId) {
      const response = await api.createTournament(payload);
      setTournamentId(response.tournament.id);
      setMessage("Tournament created.");
      await refreshTournament(response.tournament.id);
      await loadTournaments();
      setSelectedFormat(payload.format);
      return;
    }
    await api.updateTournament(tournamentId, payload);
    await refreshTournament(tournamentId);
    await loadTournaments();
    setMessage("Tournament updated.");
  }

  async function updateBracketVisibilityMode(nextMode) {
    if (!tournamentId) {
      setSetup((prev) => ({ ...prev, visibilityMode: nextMode }));
      setMessage("Create tournament first.");
      return;
    }

    try {
      const payload = buildTournamentPayload({ visibilityMode: nextMode });
      await api.updateTournament(tournamentId, payload);
      setSetup((prev) => ({ ...prev, visibilityMode: nextMode }));
      await refreshTournament(tournamentId, { keepTeamPane: true });
      await loadTournaments();
      setMessage(nextMode === "demo" ? "Demo bracket mode saved." : "Tournament bracket mode saved.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function updateBracketActivation(nextActive) {
    if (!tournamentId) {
      setSetup((prev) => ({ ...prev, bracketActive: nextActive }));
      setMessage("Create tournament first.");
      return;
    }
    try {
      const payload = buildTournamentPayload({ bracketActive: nextActive });
      await api.updateTournament(tournamentId, payload);
      await refreshTournament(tournamentId);
      await loadTournaments();
      setMessage(nextActive ? "Tournament bracket activated." : "Tournament bracket deactivated.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function publishCurrentTournament(id = tournamentId) {
    if (!id) return;
    await api.publishTournament(id);
    await loadTournaments();
    await refreshTournament(id);
    setMessage("Tournament approved and published.");
  }

  async function unpublishCurrentTournament(id = tournamentId) {
    if (!id) return;
    await api.unpublishTournament(id);
    await loadTournaments();
    await refreshTournament(id);
    setMessage("Tournament unpublished.");
  }

  async function deleteDraftTournament(id) {
    if (!id) return;
    await api.deleteTournament(id);
    if (id === tournamentId) {
      setTournamentId("");
      setState(null);
      setTeamDraft([]);
      setPoolDraft([]);
      setRosters([]);
      setApprovedRoster(null);
      setActiveRosterId("");
      setIsTeamPaneActive(false);
      setRegistrations([]);
    }
    await loadTournaments();
    setMessage("Draft tournament deleted.");
  }

  async function generateBracket() {
    if (!tournamentId) {
      setMessage("Create tournament first.");
      return;
    }
    const isDemoMode = setup.visibilityMode === "demo";
    if (isDemoMode) {
      try {
        await api.generateMatches(tournamentId);
        await refreshTournament(tournamentId, { keepTeamPane: true });
        setActivePage("bracketSchedule");
        setMessage("Demo bracket generated with placeholder teams.");
      } catch (error) {
        setMessage(error.message);
      }
      return;
    }

    const bracketTeams = approvedRoster?.teams || [];
    const bracketPlayers = approvedRoster?.players || [];
    const bracketTeamPlayers = approvedRoster?.teamPlayers || [];
    if (setup.bracketActive) {
      setMessage("Deactivate the live bracket before regenerating tournament matches.");
      return;
    }
    if (!approvedRoster) {
      setMessage("Approve a tournament roster before generating the bracket.");
      return;
    }
    if (bracketTeams.length !== Number(setup.teamCount)) {
      setMessage(`Finalize exactly ${setup.teamCount} teams before generating the bracket.`);
      return;
    }
    const invalidTeam = bracketTeams.find((team) => {
      const assignedPlayerIds = new Set(
        bracketTeamPlayers.filter((record) => record.team_id === team.id).map((record) => record.player_id),
      );
      return !bracketPlayers.some((player) => assignedPlayerIds.has(player.id) && player.isCaptain);
    });
    if (invalidTeam) {
      setMessage(`Assign a registered captain for ${invalidTeam.name} before generating the bracket.`);
      return;
    }
    try {
      await api.generateMatches(tournamentId);
      await refreshTournament(tournamentId, { keepTeamPane: true });
      setActivePage("bracketSchedule");
      setMessage("Bracket generated.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  function addCaptain() {
    if (!newCaptain.team.trim()) return;
    const team = {
      id: createId(),
      name: newCaptain.team.trim() || `${newCaptain.captain.trim()}'s Team`,
      captain: "",
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

  function addRegistrationPlayer(registration, teamId = null) {
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
        teamId,
        isCaptain: false,
      },
    ]);
  }

  function updateTeam(teamId, patch) {
    setTeamDraft((prev) => prev.map((team) => (team.id === teamId ? { ...team, ...patch } : team)));
  }

  function deleteTeam(teamId) {
    setTeamDraft((prev) => prev.filter((team) => team.id !== teamId));
    setPoolDraft((prev) => prev.map((player) => (player.teamId === teamId ? { ...player, teamId: null, isCaptain: false } : player)));
  }

  function assignPlayer(playerId, teamId) {
    setPoolDraft((prev) => prev.map((player) => (player.id === playerId ? { ...player, teamId } : player)));
  }

  function removePlayerFromTeam(playerId) {
    setPoolDraft((prev) =>
      prev.map((player) => (player.id === playerId ? { ...player, teamId: null, isCaptain: false } : player)),
    );
    setMessage("Player moved back to the available pool.");
  }

  function markCaptain(playerId, isCaptain) {
    setPoolDraft((prev) => {
      const selected = prev.find((player) => player.id === playerId);
      return prev.map((player) => {
        if (player.id === playerId) return { ...player, isCaptain };
        if (isCaptain && selected?.teamId && player.teamId === selected.teamId) return { ...player, isCaptain: false };
        return player;
      });
    });
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
    const teamsWithCaptains = teamDraft.map((team) => {
      const captain = poolDraft.find((player) => player.teamId === team.id && player.isCaptain);
      return {
        ...team,
        captain: captain?.name || "",
      };
    });
    await api.saveTeams(tournamentId, { teams: teamsWithCaptains, players: poolDraft });
    await refreshTournament(tournamentId, { keepTeamPane: true });
    await refreshRosters();
    setMessage("Teams saved.");
  }

  async function saveRosterSnapshot(name) {
    if (!tournamentId) {
      setMessage("Create tournament first.");
      return;
    }
    if (!getAuthToken()) {
      setMessage("Admin session expired. Please log in again before saving rosters.");
      return;
    }
    try {
      await saveTeams();
      const response = await api.createRoster(tournamentId, { name });
      setActiveRosterId(response.roster?.id || "");
      setIsTeamPaneActive(true);
      await refreshRosters();
      setMessage(`Roster "${name}" saved.`);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function renameRoster(rosterId, name) {
    if (!getAuthToken()) {
      setMessage("Admin session expired. Please log in again before editing rosters.");
      return;
    }
    try {
      await api.updateRoster(tournamentId, rosterId, { name });
      await refreshRosters();
      setMessage(`Roster renamed to "${name}".`);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function replaceRosterFromCurrent(rosterId, name) {
    if (!getAuthToken()) {
      setMessage("Admin session expired. Please log in again before saving rosters.");
      return;
    }
    try {
      await saveTeams();
      await api.updateRoster(tournamentId, rosterId, { name, replaceFromCurrent: true });
      await refreshRosters();
      setMessage(`Roster "${name}" updated from current teams. Approve it to use it for brackets.`);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function approveRoster(rosterId) {
    const token = getAuthToken();
    if (!token) {
      setMessage("Admin session expired. Please log in again before approving rosters.");
      return;
    }
    try {
      await api.approveRoster(tournamentId, rosterId);
      await refreshRosters();
      await refreshTournament(tournamentId, { keepTeamPane: true });
      setMessage("Tournament roster approved for bracket and schedule generation.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function deleteRoster(rosterId, name) {
    if (!getAuthToken()) {
      setMessage("Admin session expired. Please log in again before deleting rosters.");
      return;
    }
    try {
      await api.deleteRoster(tournamentId, rosterId);
      if (activeRosterId === rosterId) {
        setTeamDraft([]);
        setPoolDraft([]);
        setActiveRosterId("");
        setIsTeamPaneActive(false);
      }
      await refreshRosters();
      setMessage(`Roster "${name}" deleted.`);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function loadRosterForEditing(rosterId) {
    try {
      const payload = await api.getRoster(tournamentId, rosterId);
      const roster = payload.roster;
      setTeamDraft(roster.teams || []);
      setPoolDraft(
        (roster.players || []).map((player) => ({
          ...player,
          role: player.role || player.roles?.[0] || roles[0],
          teamId: roster.teamPlayers?.find((record) => record.player_id === player.id)?.team_id || null,
        })),
      );
      setActiveRosterId(roster.id);
      setIsTeamPaneActive(true);
      setMessage(`Loaded roster "${roster.name}".`);
    } catch (error) {
      setMessage(error.message);
    }
  }

  function createNewRosterDraft() {
    setTeamDraft([]);
    setPoolDraft([]);
    setActiveRosterId("");
    setIsTeamPaneActive(true);
    setMessage("Started a new roster draft.");
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
    const stageOrder = Object.fromEntries((state.tabs || []).map((tab, index) => [tab.id, index]));
    const orderedMatches = [...state.matches].sort((a, b) => {
      const stageDiff = (stageOrder[a.stageKey] ?? 999) - (stageOrder[b.stageKey] ?? 999);
      if (stageDiff !== 0) return stageDiff;
      const roundDiff = (a.roundIndex ?? 0) - (b.roundIndex ?? 0);
      if (roundDiff !== 0) return roundDiff;
      return (a.matchIndex ?? 0) - (b.matchIndex ?? 0);
    });
    const schedule = orderedMatches.map((match, index) => ({
      id: createId(),
      matchId: match.id,
      startAt: (match.slotAt ? new Date(match.slotAt) : new Date(Date.now() + index * 3600_000)).toISOString(),
      stream: "Main",
      status: match.status || "upcoming",
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

  return (
    <main className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <AppHeader
        pages={adminPages}
        activePage={activePage}
        setActivePage={navigateAdminPage}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
      />

      <section className="mx-auto max-w-6xl space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-3 text-sm">
          <div>
            Signed in as <span className="font-medium">{adminUser.name}</span> ({adminUser.role})
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => navigate("/")}>
              View public site
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={logout}>
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
            exportData={exportData}
            importData={importData}
            state={state}
            tournaments={tournamentList}
            refreshTournaments={loadTournaments}
            selectTournament={(id) => refreshTournament(id)}
            startNewTournament={() => {
              setTournamentId("");
              setState(null);
              setTeamDraft([]);
              setPoolDraft([]);
              setRosters([]);
              setApprovedRoster(null);
              setActiveRosterId("");
              setIsTeamPaneActive(false);
              setRegistrations([]);
            }}
            publishTournament={publishCurrentTournament}
            unpublishTournament={unpublishCurrentTournament}
            deleteTournament={deleteDraftTournament}
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
            updateTeam={updateTeam}
            deleteTeam={deleteTeam}
            removePlayerFromTeam={removePlayerFromTeam}
            rosters={rosters}
            approvedRoster={approvedRoster}
            requiredTeamCount={Number(setup.teamCount)}
            activeRosterId={activeRosterId}
            isTeamPaneActive={isTeamPaneActive}
            loadRosterForEditing={loadRosterForEditing}
            createNewRosterDraft={createNewRosterDraft}
            saveRosterSnapshot={saveRosterSnapshot}
            renameRoster={renameRoster}
            replaceRosterFromCurrent={replaceRosterFromCurrent}
            approveRoster={approveRoster}
            deleteRoster={deleteRoster}
          />
        )}

        {activePage === "announcements" && (
          <AnnouncementsPage setup={setup} setSetup={setSetup} saveTournament={bootstrapTournament} />
        )}

        {activePage === "bracketSchedule" && (
          <div className="space-y-4">
            <BracketPage
              state={state}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              groupedMatches={groupedMatches}
              submitResult={submitResult}
              updateMatch={updateMatch}
              generateBracket={generateBracket}
              setup={setup}
              rosters={rosters}
              approvedRoster={approvedRoster}
              updateBracketVisibilityMode={updateBracketVisibilityMode}
              updateBracketActivation={updateBracketActivation}
              approveRoster={approveRoster}
            />
            <SchedulePage state={state} saveSchedule={saveSchedule} saveCustomSchedule={saveCustomSchedule} />
          </div>
        )}

        {activePage === "standings" && <StandingsPage standings={state?.standings} />}

        {activePage === "registrations" && (
          <RegistrationCrmPage
            tournamentId={tournamentId}
            registrations={registrations}
            refreshRegistrations={() => refreshRegistrations(tournamentId)}
          />
        )}

        {activePage === "users" && <AdminUsersPage currentUser={adminUser} />}
      </section>
      <AppFooter navigate={navigateAdminPage} mode="admin" />
      <ScrollToTopButton />
    </main>
  );
}

export default App;
