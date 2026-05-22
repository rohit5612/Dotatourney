import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { AppFooter } from "./components/AppFooter";
import { AppHeader } from "./components/AppHeader";
import { PageLoadingSpinner } from "./components/PageLoadingSpinner";
import { ScrollToTopButton } from "./components/ScrollToTopButton";
import { buildDefaultSeriesRules, mergeBlastSeriesRules, roles } from "./constants/tournament";
import { api, getAuthToken, setAuthToken } from "./lib/api";
import { toDateInputValue, toDatetimeLocalValue } from "./utils/datetime";
import { announcementsToAdminFormState, announcementsToApiPayload, bannerAnnouncementsToAdminFormState, bannerAnnouncementsToApiPayload } from "./lib/announcementEntries.js";
import { PrimaryViewTabs } from "./components/navigation/TournamentTabs.jsx";
import { augmentGroupedBracketMatches } from "./components/bracket/bracketLayout.js";
import { createId, getInitialDarkMode } from "./utils/client";
import { isGroupAssignmentValid } from "./utils/groupAssignment.js";
import { playerDisplayName } from "./utils/teamPage.js";

const adminPages = ["registrations", "teams", "setup", "announcements", "bracketSchedule", "standings", "users"];

const PublicApp = lazy(() => import("./pages/PublicPages.jsx").then((m) => ({ default: m.PublicApp })));
const AdminAuthPage = lazy(() => import("./pages/AdminAuthPage.jsx").then((m) => ({ default: m.AdminAuthPage })));
const AdminUsersPage = lazy(() => import("./pages/AdminUsersPage.jsx").then((m) => ({ default: m.AdminUsersPage })));
const AnnouncementsPage = lazy(() => import("./pages/AnnouncementsPage.jsx").then((m) => ({ default: m.AnnouncementsPage })));
const BracketPage = lazy(() => import("./pages/BracketPage.jsx").then((m) => ({ default: m.BracketPage })));
const RegistrationCrmPage = lazy(() =>
  import("./pages/RegistrationCrmPage.jsx").then((m) => ({ default: m.RegistrationCrmPage })),
);
const SchedulePage = lazy(() => import("./pages/SchedulePage.jsx").then((m) => ({ default: m.SchedulePage })));
const SetupPage = lazy(() => import("./pages/SetupPage.jsx").then((m) => ({ default: m.SetupPage })));
const StandingsPage = lazy(() => import("./pages/StandingsPage.jsx").then((m) => ({ default: m.StandingsPage })));
const TeamsPage = lazy(() => import("./pages/TeamsPage.jsx").then((m) => ({ default: m.TeamsPage })));

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
    discordUrl: "https://discord.gg/sV2PhYc6A3",
    rulebook: "",
    liveYoutubeUrl: "",
    announcements: [],
    bannerAnnouncement: { body: "", postedAt: "" },
    visibilityMode: "demo",
    bracketActive: false,
    registrationCodePrefix: "BPC",
    paymentQrImage: "",
    paymentUpiId: "",
    registrationCodeSeq: 0,
    registrationsOpen: false,
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
  const [bracketScheduleView, setBracketScheduleView] = useState("brackets");

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

  function resolveActiveTabAfterRefresh(currentTab, payload, { resetActiveTab = false, tournamentChanged = false } = {}) {
    const tabs = payload?.tabs || [];
    if (!tabs.length) return currentTab;

    if (resetActiveTab || tournamentChanged) {
      return tabs[0].id;
    }

    const tabIds = new Set(tabs.map((tab) => tab.id));
    if (tabIds.has(currentTab)) return currentTab;

    if ((currentTab === "blast-lastchance" || currentTab === "blast-playin") && tabIds.has("blast-qualifiers")) {
      return "blast-qualifiers";
    }

    const hasMatchesForTab = (payload.matches || []).some((match) => match.stageKey === currentTab);
    if (hasMatchesForTab) return currentTab;

    return tabs[0].id;
  }

  async function refreshTournament(id = tournamentId, options = {}) {
    if (!id) return;
    const previousTournamentId = tournamentId;
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
        seriesRules: (() => {
          const fmt = payload.tournament.format ?? prev.format;
          const tc = payload.tournament.team_count ?? prev.teamCount;
          const st = payload.tournament.series_type ?? prev.seriesType;
          const fromServer =
            payload.tournament.series_rules && Object.keys(payload.tournament.series_rules).length > 0
              ? payload.tournament.series_rules
              : null;
          const base = fromServer ?? prev.seriesRules ?? {};
          if (fmt === "blast") return mergeBlastSeriesRules(base, tc, st);
          return fromServer ?? prev.seriesRules;
        })(),
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
        liveYoutubeUrl: payload.tournament.live_youtube_url ?? prev.liveYoutubeUrl ?? "",
        announcements: announcementsToAdminFormState(payload.tournament.announcements),
        bannerAnnouncement: bannerAnnouncementsToAdminFormState(payload.tournament.banner_announcements),
        visibilityMode: payload.tournament.visibility_mode ?? prev.visibilityMode,
        bracketActive: payload.tournament.bracket_active ?? prev.bracketActive,
        registrationCodePrefix: payload.tournament.registration_code_prefix ?? prev.registrationCodePrefix ?? "BPC",
        paymentQrImage: payload.tournament.payment_qr_image ?? prev.paymentQrImage ?? "",
        paymentUpiId: payload.tournament.payment_upi_id ?? prev.paymentUpiId ?? "",
        registrationCodeSeq: payload.tournament.registration_code_seq ?? prev.registrationCodeSeq ?? 0,
        registrationsOpen:
          typeof payload.tournament.registrations_open === "boolean"
            ? payload.tournament.registrations_open
            : prev.registrationsOpen ?? false,
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
    if (payload.tabs?.length) {
      setActiveTab((current) =>
        resolveActiveTabAfterRefresh(current, payload, {
          resetActiveTab: Boolean(options.resetActiveTab),
          tournamentChanged: Boolean(previousTournamentId && id !== previousTournamentId),
        }),
      );
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
      announcements: announcementsToApiPayload(overrides.announcements ?? setup.announcements),
      bannerAnnouncements: bannerAnnouncementsToApiPayload(overrides.bannerAnnouncement ?? setup.bannerAnnouncement),
    };
  }

  async function saveLiveYoutubeUrl(url) {
    const trimmed = String(url ?? "").trim();
    if (!tournamentId) {
      setSetup((prev) => ({ ...prev, liveYoutubeUrl: trimmed }));
      setMessage("Create tournament first.");
      return;
    }
    setSetup((prev) => ({ ...prev, liveYoutubeUrl: trimmed }));
    await api.updateTournament(tournamentId, buildTournamentPayload({ liveYoutubeUrl: trimmed }));
    await refreshTournament(tournamentId);
    setMessage("Live stream link saved.");
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

  async function setRegistrationsAccepting(nextOpen) {
    if (!tournamentId) {
      setSetup((prev) => ({ ...prev, registrationsOpen: nextOpen }));
      setMessage("Save the tournament draft first.");
      return;
    }
    try {
      const payload = buildTournamentPayload({ registrationsOpen: nextOpen });
      await api.updateTournament(tournamentId, payload);
      setSetup((prev) => ({ ...prev, registrationsOpen: nextOpen }));
      await refreshTournament(tournamentId, { keepTeamPane: true });
      await loadTournaments();
      setMessage(nextOpen ? "Registration is open on the public site." : "Registration is closed on the public site.");
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
    if (setup.format === "blast" && !isGroupAssignmentValid(bracketTeams)) {
      setMessage("Assign and save Group A / Group B before generating the bracket.");
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
      logoUrl: "",
      accentColor: "",
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
    const displayName = registration.displayName || registration.steamName || registration.name;
    setPoolDraft((prev) => [
      ...prev,
      {
        id: createId(),
        registrationId: registration.id,
        name: displayName,
        displayName,
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
    const normalizedPlayers = poolDraft.map((player) => {
      const label = playerDisplayName(player);
      return {
        ...player,
        name: label,
        displayName: player.displayName || player.display_name || label,
      };
    });
    const teamsWithCaptains = teamDraft.map((team) => {
      const captain = normalizedPlayers.find((player) => player.teamId === team.id && player.isCaptain);
      return {
        ...team,
        captain: captain ? playerDisplayName(captain) : "",
      };
    });
    await api.saveTeams(tournamentId, { teams: teamsWithCaptains, players: normalizedPlayers });
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
      setMessage("Tournament roster approved. Assign groups A and B, then generate the bracket.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function saveGroupAssignments(assignments) {
    if (!tournamentId) {
      setMessage("Create tournament first.");
      return;
    }
    try {
      const payload = await api.saveGroupAssignments(tournamentId, assignments);
      setApprovedRoster(payload.approvedRoster || null);
      setMessage("Group assignment saved.");
    } catch (error) {
      setMessage(error.message);
      throw error;
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
      const [payload, tournamentPayload] = await Promise.all([
        api.getRoster(tournamentId, rosterId),
        api.getTournament(tournamentId),
      ]);
      const roster = payload.roster;
      const logoBySourceId = new Map(
        (tournamentPayload.teams || []).map((team) => [team.id, team.logoUrl || team.logo_url || ""]),
      );
      const accentBySourceId = new Map(
        (tournamentPayload.teams || []).map((team) => [team.id, team.accentColor || team.accent_color || ""]),
      );
      setTeamDraft(
        (roster.teams || []).map((team) => ({
          ...team,
          logoUrl: team.logoUrl || team.logo_url || logoBySourceId.get(team.sourceTeamId) || "",
          accentColor: team.accentColor || team.accent_color || accentBySourceId.get(team.sourceTeamId) || "",
        })),
      );
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
    await refreshTournament(tournamentId, { keepActiveTab: true });
  }

  async function updateMatch(matchId, payload) {
    await api.updateMatch(tournamentId, matchId, payload);
    await refreshTournament(tournamentId, { keepActiveTab: true });
  }

  async function saveCustomSchedule(schedule) {
    if (!tournamentId) {
      throw new Error("No tournament selected.");
    }
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
    return augmentGroupedBracketMatches(groups);
  }, [state?.matches]);

  async function logout() {
    await api.logoutAdmin().catch(() => {});
    setAuthToken("");
    setAdminUser(null);
    navigate("/");
  }

  if (!path.startsWith("/admin")) {
    return (
      <Suspense fallback={<PageLoadingSpinner label="Loading…" />}>
        <PublicApp path={path} navigate={navigate} />
      </Suspense>
    );
  }

  const inviteToken = path.startsWith("/admin/invite/") ? path.split("/").pop() : "";

  if (!adminUser) {
    return (
      <Suspense fallback={<PageLoadingSpinner label="Loading admin…" />}>
        <AdminAuthPage inviteToken={inviteToken} onAuthed={setAdminUser} />
      </Suspense>
    );
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
          <Suspense fallback={<PageLoadingSpinner label="Loading setup…" />}>
          <SetupPage
            setup={setup}
            setSetup={setSetup}
            selectedFormat={selectedFormat}
            onFormatChange={(nextFormat) => {
              setSelectedFormat(nextFormat);
              setSetup((prev) => ({
                ...prev,
                format: nextFormat,
                seriesRules: buildDefaultSeriesRules(nextFormat, prev.seriesType, nextFormat === "blast" ? prev.teamCount : undefined),
              }));
            }}
            bootstrapTournament={bootstrapTournament}
            exportData={exportData}
            importData={importData}
            tournamentId={tournamentId}
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
            setRegistrationsAccepting={setRegistrationsAccepting}
          />
          </Suspense>
        )}

        {activePage === "teams" && (
          <Suspense fallback={<PageLoadingSpinner label="Loading teams…" />}>
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
          </Suspense>
        )}

        {activePage === "announcements" && (
          <Suspense fallback={<PageLoadingSpinner label="Loading announcements…" />}>
            <AnnouncementsPage setup={setup} setSetup={setSetup} saveTournament={bootstrapTournament} />
          </Suspense>
        )}

        {activePage === "bracketSchedule" && (
          <div className="space-y-4">
            <PrimaryViewTabs
              ariaLabel="Brackets or schedule"
              value={bracketScheduleView}
              onChange={setBracketScheduleView}
              onTabClick={() => window.scrollTo({ top: 0, behavior: "auto" })}
              tabs={[
                { id: "brackets", label: "Brackets" },
                { id: "schedule", label: "Schedule" },
              ]}
            />
            {bracketScheduleView === "brackets" ? (
              <Suspense fallback={<PageLoadingSpinner label="Loading bracket…" />}>
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
                saveGroupAssignments={saveGroupAssignments}
              />
              </Suspense>
            ) : (
              <div className="relative left-1/2 w-[min(100vw-2rem,88rem)] max-w-none -translate-x-1/2">
                <Suspense fallback={<PageLoadingSpinner label="Loading schedule…" />}>
                <SchedulePage
                  state={state}
                  saveCustomSchedule={saveCustomSchedule}
                  teamDraft={teamDraft}
                  approvedRoster={approvedRoster}
                  liveYoutubeUrl={setup.liveYoutubeUrl}
                  onSaveLiveYoutubeUrl={saveLiveYoutubeUrl}
                />
                </Suspense>
              </div>
            )}
          </div>
        )}

        {activePage === "standings" && (
          <Suspense fallback={<PageLoadingSpinner label="Loading standings…" />}>
          <StandingsPage
            standings={state?.standings}
            groupedStandings={state?.groupedStandings}
            format={state?.tournament?.format}
          />
          </Suspense>
        )}

        {activePage === "registrations" && (
          <Suspense fallback={<PageLoadingSpinner label="Loading registrations…" />}>
          <RegistrationCrmPage
            tournamentId={tournamentId}
            registrations={registrations}
            refreshRegistrations={() => refreshRegistrations(tournamentId)}
          />
          </Suspense>
        )}

        {activePage === "users" && (
          <Suspense fallback={<PageLoadingSpinner label="Loading users…" />}>
            <AdminUsersPage currentUser={adminUser} />
          </Suspense>
        )}
      </section>
      <AppFooter navigate={navigateAdminPage} mode="admin" />
      <ScrollToTopButton />
    </main>
  );
}

export default App;
