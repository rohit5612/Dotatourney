import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AppFooter } from "../components/AppFooter";
import { AppHeader } from "../components/AppHeader";
import { PageLoadingSpinner } from "../components/PageLoadingSpinner";
import { ScrollToTopButton } from "../components/ScrollToTopButton";
import { buildDefaultSeriesRules, mergeBlastSeriesRules, roles } from "../constants/tournament";
import { api, getAuthToken, setAuthToken, setUnauthorizedHandler } from "../lib/api";
import { toDateInputValue, toDatetimeLocalValue } from "../utils/datetime";
import { announcementsToAdminFormState, announcementsToApiPayload, bannerAnnouncementsToAdminFormState, bannerAnnouncementsToApiPayload } from "../lib/announcementEntries.js";
import { honorsToApiPayload, normalizeHonorsAdmin } from "../utils/tournamentHonors.js";
import { PrimaryViewTabs } from "../components/navigation/TournamentTabs.jsx";
import { augmentGroupedBracketMatches } from "../components/bracket/bracketLayout.js";
import { resolveBlastBracketMatches } from "../utils/blastSeeding.js";
import { createId, getInitialDarkMode } from "../utils/client";
import { isGroupAssignmentValid } from "../utils/groupAssignment.js";
import { playerDisplayName } from "../utils/teamPage.js";
import {
  buildTournamentFullName,
  parseSeasonLabelFromName,
  seasonSlugFromLabel,
  TOURNAMENT_BRAND,
} from "../utils/tournamentNaming.js";

const adminPages = ["setup", "playerCrm", "teams", "cards", "announcements", "honors", "seasons", "bracketSchedule", "standings", "users"];

import { filterAdminPages, adminCanReadResource } from "../lib/adminRbac.js";
import { AdminAccessProvider, useAdminAccess } from "./context/AdminAccessContext.jsx";
import { AdminShell } from "./layout/AdminShell.jsx";
import { AdminTournamentProvider } from "./context/AdminTournamentContext.jsx";
import { AdminTournamentBanner } from "./components/AdminTournamentBanner.jsx";
import { AdminGlassPanel } from "./components/AdminGlassPanel.jsx";
import "../styles/admin-shell.css";

const AdminAuthPage = lazy(() => import("../pages/AdminAuthPage.jsx").then((m) => ({ default: m.AdminAuthPage })));
const AdminUsersPage = lazy(() => import("./users/AdminUsersPage.jsx").then((m) => ({ default: m.AdminUsersPage })));
const AnnouncementsPage = lazy(() => import("./announcements/AnnouncementsPage.jsx").then((m) => ({ default: m.AnnouncementsPage })));
const HonorsPage = lazy(() => import("./honors/HonorsPage.jsx").then((m) => ({ default: m.HonorsPage })));
const BracketPage = lazy(() => import("./bracket/BracketPage.jsx").then((m) => ({ default: m.BracketPage })));
const PlayerCrmPage = lazy(() => import("./playerCrm/PlayerCrmPage.jsx").then((m) => ({ default: m.PlayerCrmPage })));
const SchedulePage = lazy(() => import("./bracket/BracketPage.jsx").then((m) => ({ default: m.SchedulePage })));
const SetupPage = lazy(() => import("./setup/SetupPage.jsx").then((m) => ({ default: m.SetupPage })));
const SeasonsAdminPage = lazy(() => import("./seasons/SeasonsAdminPage.jsx").then((m) => ({ default: m.SeasonsAdminPage })));
const StandingsPage = lazy(() => import("./standings/StandingsPage.jsx").then((m) => ({ default: m.StandingsPage })));
const TeamsPage = lazy(() => import("./teams/TeamsPage.jsx").then((m) => ({ default: m.TeamsPage })));
const CardsCommercePage = lazy(() =>
  import("./cards/CardsCommercePage.jsx").then((m) => ({ default: m.CardsCommercePage })),
);

function AdminViewOnlyBanner({ pageId }) {
  const access = useAdminAccess();
  if (!pageId || pageId === "users" || access.isSuperadmin || access.canWritePage(pageId)) return null;
  return (
    <AdminGlassPanel subtle className="text-sm text-muted-foreground">
      View-only access for this section. Contact superadmin to grant create, update, or delete permissions.
    </AdminGlassPanel>
  );
}

export function AdminConsole() {
  const location = useLocation();
  const routerNavigate = useNavigate();
  const path = location.pathname;
  const [activePage, setActivePage] = useState("setup");
  const [tournamentId, setTournamentId] = useState("");
  const [state, setState] = useState(null);
  const [activeTab, setActiveTab] = useState("upper");
  const [selectedFormat, setSelectedFormat] = useState("dse");
  const [setup, setSetup] = useState({
    seasonLabel: "",
    name: TOURNAMENT_BRAND,
    format: "dse",
    seriesType: "bo3",
    teamCount: 8,
    seriesRules: buildDefaultSeriesRules("dse", "bo3"),
    slug: "season",
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
    tournamentHonors: { displayPodiumCount: 2, mvp: null, customCards: [] },
    visibilityMode: "demo",
    bracketActive: false,
    registrationCodePrefix: "BPC",
    paymentQrImage: "",
    paymentUpiId: "",
    seasonCardBg: "",
    seasonCardBadge: "",
    registrationCodeSeq: 0,
    registrationsOpen: false,
    registrationCap: "",
    engineConfig: null,
    engineTemplateId: "",
  });
  const [teamDraft, setTeamDraft] = useState([]);
  const [poolDraft, setPoolDraft] = useState([]);
  const [rosters, setRosters] = useState([]);
  const [approvedRoster, setApprovedRoster] = useState(null);
  const [qualifierSeeding, setQualifierSeeding] = useState(null);
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
    routerNavigate(nextPath);
  }

  function navigateAdminPage(page) {
    setActivePage(page);
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [path]);

  useEffect(() => {
    if (path.startsWith("/admin") && path !== "/admin" && !path.startsWith("/admin/invite/")) {
      routerNavigate("/admin", { replace: true });
    }
  }, [path, routerNavigate]);

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
        seasonLabel: parseSeasonLabelFromName(payload.tournament.name ?? prev.name),
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
        tournamentHonors: normalizeHonorsAdmin(payload.tournament.tournament_honors),
        visibilityMode: payload.tournament.visibility_mode ?? prev.visibilityMode,
        bracketActive: payload.tournament.bracket_active ?? prev.bracketActive,
        registrationCodePrefix: payload.tournament.registration_code_prefix ?? prev.registrationCodePrefix ?? "BPC",
        paymentQrImage: payload.tournament.payment_qr_image ?? prev.paymentQrImage ?? "",
        paymentUpiId: payload.tournament.payment_upi_id ?? prev.paymentUpiId ?? "",
        seasonCardBg: payload.tournament.season_card_bg ?? prev.seasonCardBg ?? "",
        seasonCardBadge: payload.tournament.season_card_badge ?? prev.seasonCardBadge ?? "",
        registrationCodeSeq: payload.tournament.registration_code_seq ?? prev.registrationCodeSeq ?? 0,
        registrationsOpen:
          typeof payload.tournament.registrations_open === "boolean"
            ? payload.tournament.registrations_open
            : prev.registrationsOpen ?? false,
        registrationCap:
          payload.tournament.registration_cap != null && payload.tournament.registration_cap !== ""
            ? String(payload.tournament.registration_cap)
            : "",
        engineConfig: payload.tournament.engine_config ?? prev.engineConfig ?? null,
        engineTemplateId: payload.tournament.engine_template_id ?? prev.engineTemplateId ?? "",
      }));
      setTournamentId(payload.tournament.id);
      try {
        window.localStorage.setItem("bpcl-admin-tournament-id", payload.tournament.id);
      } catch {
        // ignore
      }
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
    await refreshQualifierSeeding(payload.tournament?.id || id);
  }

  async function refreshQualifierSeeding(id = tournamentId) {
    if (!id) {
      setQualifierSeeding(null);
      return;
    }
    try {
      const payload = await api.getQualifierSeeding(id);
      setQualifierSeeding(payload);
    } catch {
      setQualifierSeeding(null);
    }
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
    const merged = {
      ...setup,
      ...overrides,
      teamCount: Number(setup.teamCount),
      darkMode: true,
      announcements: announcementsToApiPayload(overrides.announcements ?? setup.announcements),
      bannerAnnouncements: bannerAnnouncementsToApiPayload(overrides.bannerAnnouncement ?? setup.bannerAnnouncement),
      tournamentHonors: honorsToApiPayload(overrides.tournamentHonors ?? setup.tournamentHonors),
    };
    const seasonLabel = String(merged.seasonLabel ?? parseSeasonLabelFromName(merged.name)).trim();
    merged.seasonLabel = seasonLabel;
    merged.name = buildTournamentFullName(seasonLabel);
    merged.slug = seasonSlugFromLabel(seasonLabel);
    if (merged.engineConfig == null) {
      delete merged.engineConfig;
    }
    if (merged.engineTemplateId === "") {
      merged.engineTemplateId = null;
    }
    if (merged.registrationCap === "" || merged.registrationCap == null) {
      merged.registrationCap = null;
    } else {
      merged.registrationCap = Number(merged.registrationCap);
    }
    return merged;
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
    const wasPublished = Boolean(state?.tournament?.is_published);
    await api.updateTournament(tournamentId, payload);
    api.clearPublicTournamentCache();
    await refreshTournament(tournamentId);
    await loadTournaments();
    setMessage(wasPublished ? "Changes saved to the public site." : "Tournament updated.");
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
    setMessage("Tournament published.");
  }

  async function approveCurrentTournament(id = tournamentId) {
    if (!id) return;
    try {
      await api.approveTournament(id);
      await loadTournaments();
      await refreshTournament(id);
      setMessage("Tournament approved.");
    } catch (error) {
      setMessage(error.message || "Could not approve tournament.");
    }
  }

  async function completeCurrentTournament(id = tournamentId) {
    if (!id) return;
    try {
      await api.completeTournament(id, { force: false });
      await loadTournaments();
      await refreshTournament(id);
      setMessage("Tournament marked complete.");
    } catch (error) {
      if (error.status === 409) {
        const anyway = window.confirm(`${error.message}\n\nComplete anyway?`);
        if (!anyway) return;
        await api.completeTournament(id, { force: true });
        await loadTournaments();
        await refreshTournament(id);
        setMessage("Tournament marked complete.");
        return;
      }
      setMessage(error.message);
    }
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
    if (!getAuthToken()) {
      setMessage("Admin session expired. Please log in again before saving teams.");
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
    const syncApprovedRosterId =
      approvedRoster?.id && activeRosterId === approvedRoster.id ? approvedRoster.id : undefined;
    try {
      const payload = await api.saveTeams(tournamentId, {
        teams: teamsWithCaptains,
        players: normalizedPlayers,
        syncApprovedRosterId,
      });
      if (payload.approvedRoster) {
        setApprovedRoster(payload.approvedRoster);
      }
      await refreshTournament(tournamentId, { keepTeamPane: true });
      await refreshRosters();
      setMessage(
        syncApprovedRosterId
          ? "Teams saved. Approved roster updated without re-approval."
          : "Teams saved.",
      );
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function refreshTeamDisplayNames() {
    if (!tournamentId) {
      setMessage("Create tournament first.");
      return;
    }
    if (!getAuthToken()) {
      setMessage("Admin session expired. Please log in again.");
      return;
    }
    const confirmed = window.confirm(
      "Refresh all team player names from Registration CRM? Approved roster status is kept — no re-approval, bracket, or schedule regeneration.",
    );
    if (!confirmed) return;
    try {
      const result = await api.refreshTeamDisplayNames(tournamentId);
      if (result.approvedRoster) {
        setApprovedRoster(result.approvedRoster);
      }
      await refreshTournament(tournamentId, { keepTeamPane: true });
      await refreshRosters();
      const parts = [];
      if (result.workingPlayersUpdated) parts.push(`${result.workingPlayersUpdated} team player(s)`);
      if (result.snapshotPlayersUpdated) parts.push(`${result.snapshotPlayersUpdated} roster snapshot player(s)`);
      if (result.captainsUpdated) parts.push(`${result.captainsUpdated} captain label(s)`);
      if (result.lineupsUpdated) parts.push(`${result.lineupsUpdated} lineup name(s)`);
      setMessage(
        parts.length
          ? `Display names refreshed (${parts.join(", ")}).`
          : "All display names already match Registration CRM.",
      );
    } catch (error) {
      setMessage(error.message);
    }
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

  async function saveQualifierSeeding(assignments, options = {}) {
    if (!tournamentId) {
      setMessage("Create tournament first.");
      return;
    }
    try {
      const result = await api.saveQualifierSeeding(
        tournamentId,
        options.reset ? { reset: true } : { assignments: assignments || {} },
      );
      api.clearPublicTournamentCache();
      setQualifierSeeding({
        groupsComplete: result.groupsComplete,
        anyGroupsComplete: result.anyGroupsComplete,
        completedGroups: result.completedGroups,
        teamCount: result.teamCount,
        overrides: result.overrides,
        autoMap: result.autoMap,
        effectiveMap: result.effectiveMap,
        slots: result.slots,
      });
      setState((prev) => ({
        ...prev,
        matches: result.matches ?? prev?.matches,
        standings: result.standings ?? prev?.standings,
        groupedStandings: result.groupedStandings ?? prev?.groupedStandings,
        tournament: result.tournament ?? prev?.tournament,
      }));
      if (result.tournament?.engine_config) {
        setSetup((prev) => ({ ...prev, engineConfig: result.tournament.engine_config }));
      }
      setMessage(
        options.reset
          ? "Manual group standings reset to match results."
          : "Group standings saved. Bracket, schedule, and standings updated.",
      );
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
      setMessage(
        roster.status === "approved"
          ? `Loaded approved roster "${roster.name}". Edit teams above, then Save teams — no re-approval needed.`
          : `Loaded roster "${roster.name}".`,
      );
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
    const result = await api.recordResult(tournamentId, matchId, winner);
    api.clearPublicTournamentCache();
    setState((prev) => ({
      ...prev,
      matches: result.matches ?? prev?.matches,
      standings: result.standings ?? prev?.standings,
      groupedStandings: result.groupedStandings ?? prev?.groupedStandings,
    }));
    await refreshTournament(tournamentId, { keepActiveTab: true });
  }

  async function updateMatch(matchId, payload) {
    const result = await api.updateMatch(tournamentId, matchId, payload);
    if (result.matches) {
      api.clearPublicTournamentCache();
      setState((prev) => ({
        ...prev,
        matches: result.matches ?? prev?.matches,
        standings: result.standings ?? prev?.standings,
        groupedStandings: result.groupedStandings ?? prev?.groupedStandings,
      }));
    }
    await refreshTournament(tournamentId, { keepActiveTab: true });
  }

  async function applySeriesRulesToUpcoming() {
    if (!tournamentId) {
      setMessage("Create or select a tournament first.");
      return;
    }
    try {
      const result = await api.applySeriesRules(tournamentId);
      setState((prev) => ({
        ...prev,
        matches: result.matches ?? prev?.matches,
      }));
      await refreshTournament(tournamentId, { keepActiveTab: true });
      const count = result.updatedCount ?? 0;
      setMessage(
        count === 0
          ? "No upcoming matches needed series updates."
          : `Updated series length on ${count} upcoming match${count === 1 ? "" : "es"}.`,
      );
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function refreshBracketProgression() {
    if (!tournamentId) {
      setMessage("Create or select a tournament first.");
      return;
    }
    try {
      const result = await api.refreshBracketProgression(tournamentId);
      api.clearPublicTournamentCache();
      setState((prev) => ({
        ...prev,
        matches: result.matches ?? prev?.matches,
        standings: result.standings ?? prev?.standings,
        groupedStandings: result.groupedStandings ?? prev?.groupedStandings,
      }));
      await refreshTournament(tournamentId, { keepActiveTab: true });
      const count = result.changedCount ?? 0;
      setMessage(
        count === 0
          ? "Playoff and fed slots already match saved results."
          : `Refreshed team slots on ${count} match${count === 1 ? "" : "es"} from saved results (bracket, schedule, and public site).`,
      );
    } catch (error) {
      setMessage(error.message);
    }
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

  const bracketState = useMemo(() => {
    if (!state) return state;
    const format = setup?.format || state.tournament?.format;
    const matches = resolveBlastBracketMatches(
      state.matches || [],
      state.groupedStandings || [],
      format,
      state.tournament?.engine_config,
    );
    return { ...state, matches };
  }, [state, setup?.format]);

  const groupedMatches = useMemo(() => {
    const groups = {};
    (bracketState?.matches || []).forEach((match) => {
      if (!groups[match.stageKey]) groups[match.stageKey] = [];
      groups[match.stageKey].push(match);
    });
    return augmentGroupedBracketMatches(groups);
  }, [bracketState?.matches]);

  const tournamentContextValue = useMemo(
    () => ({
      activeTournamentId: tournamentId,
      activeTournament: state?.tournament,
      tournamentList,
      publishedTournament: tournamentList.find((t) => t.is_published),
      selectTournament: (id) => refreshTournament(id),
    }),
    [tournamentId, state?.tournament, tournamentList],
  );

  async function logout() {
    await api.logoutAdmin().catch(() => {});
    setAuthToken("");
    setAdminUser(null);
    navigate("/");
  }

  const allowedPages = useMemo(() => filterAdminPages(adminPages, adminUser), [adminUser]);

  const bracketScheduleTabs = useMemo(
    () =>
      [
        { id: "brackets", label: "Brackets", resource: "bracketSchedule.brackets" },
        { id: "schedule", label: "Schedule", resource: "bracketSchedule.schedule" },
      ].filter((tab) => adminCanReadResource(adminUser, tab.resource)),
    [adminUser],
  );

  useEffect(() => {
    if (!adminUser || allowedPages.includes(activePage)) return;
    setActivePage(allowedPages[0] || "setup");
  }, [adminUser, allowedPages, activePage]);

  useEffect(() => {
    if (!bracketScheduleTabs.length) return;
    if (!bracketScheduleTabs.some((tab) => tab.id === bracketScheduleView)) {
      setBracketScheduleView(bracketScheduleTabs[0].id);
    }
  }, [bracketScheduleTabs, bracketScheduleView]);

  const inviteToken = path.startsWith("/admin/invite/") ? path.split("/").pop() : "";

  if (!adminUser) {
    return (
      <AdminShell darkMode={darkMode}>
        <Suspense fallback={<PageLoadingSpinner label="Loading admin…" />}>
          <AdminAuthPage inviteToken={inviteToken} onAuthed={setAdminUser} darkMode={darkMode} setDarkMode={setDarkMode} />
        </Suspense>
      </AdminShell>
    );
  }

  const showTournamentBanner = !["setup", "playerCrm", "users", "seasons"].includes(activePage);

  return (
    <AdminShell darkMode={darkMode}>
      <AppHeader
        pages={allowedPages}
        activePage={activePage}
        setActivePage={navigateAdminPage}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
      />

      <AdminAccessProvider user={adminUser}>
      <AdminTournamentProvider value={tournamentContextValue}>
        <section className="admin-console-main mx-auto max-w-[88rem] space-y-4 p-4">
          <AdminGlassPanel subtle className="flex flex-wrap items-center justify-between gap-2 text-sm">
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
          </AdminGlassPanel>
          {message ? (
            <AdminGlassPanel subtle className="text-sm text-secondary">
              {message}
            </AdminGlassPanel>
          ) : null}
          <AdminViewOnlyBanner pageId={activePage} />
          {showTournamentBanner ? <AdminTournamentBanner showSelector /> : null}

        {activePage === "setup" && (
          <Suspense fallback={<PageLoadingSpinner label="Loading setup…" />}>
          <SetupPage
            setup={setup}
            setSetup={setSetup}
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
            approveTournament={approveCurrentTournament}
            completeTournament={completeCurrentTournament}
            unpublishTournament={unpublishCurrentTournament}
            deleteTournament={deleteDraftTournament}
            setRegistrationsAccepting={setRegistrationsAccepting}
            setMessage={setMessage}
          />
          </Suspense>
        )}

        {activePage === "playerCrm" && (
          <Suspense fallback={<PageLoadingSpinner label="Loading player CRM…" />}>
            <PlayerCrmPage
              tournamentId={tournamentId}
              registrations={registrations}
              refreshRegistrations={() => refreshRegistrations(tournamentId)}
              setMessage={setMessage}
            />
          </Suspense>
        )}

        {activePage === "cards" && (
          <Suspense fallback={<PageLoadingSpinner label="Loading cards…" />}>
            <CardsCommercePage tournamentId={tournamentId} message={message} setMessage={setMessage} />
          </Suspense>
        )}

        {activePage === "teams" && (
          <Suspense fallback={<PageLoadingSpinner label="Loading teams…" />}>
          <TeamsPage
            tournamentId={tournamentId}
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
            refreshTeamDisplayNames={refreshTeamDisplayNames}
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
            tournamentId={tournamentId}
          />
          </Suspense>
        )}

        {activePage === "announcements" && (
          <Suspense fallback={<PageLoadingSpinner label="Loading announcements…" />}>
            <AnnouncementsPage setup={setup} setSetup={setSetup} saveTournament={bootstrapTournament} />
          </Suspense>
        )}

        {activePage === "honors" && (
          <Suspense fallback={<PageLoadingSpinner label="Loading honors…" />}>
            <HonorsPage
              setup={setup}
              setSetup={setSetup}
              saveTournament={bootstrapTournament}
              honorsPreview={state?.honors}
              approvedRoster={approvedRoster}
            />
          </Suspense>
        )}

        {activePage === "seasons" && (
          <Suspense fallback={<PageLoadingSpinner label="Loading seasons…" />}>
            <SeasonsAdminPage />
          </Suspense>
        )}

        {activePage === "bracketSchedule" && bracketScheduleTabs.length > 0 && (
          <div className="space-y-4">
            {bracketScheduleTabs.length > 1 ? (
              <PrimaryViewTabs
                ariaLabel="Brackets or schedule"
                value={bracketScheduleView}
                onChange={setBracketScheduleView}
                onTabClick={() => window.scrollTo({ top: 0, behavior: "auto" })}
                tabs={bracketScheduleTabs.map(({ id, label }) => ({ id, label }))}
              />
            ) : null}
            {bracketScheduleView === "brackets" && adminCanReadResource(adminUser, "bracketSchedule.brackets") ? (
              <Suspense fallback={<PageLoadingSpinner label="Loading bracket…" />}>
              <BracketPage
                state={bracketState}
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
                saveQualifierSeeding={saveQualifierSeeding}
                refreshQualifierSeeding={refreshQualifierSeeding}
                qualifierSeeding={qualifierSeeding}
                applySeriesRulesToUpcoming={applySeriesRulesToUpcoming}
                refreshBracketProgression={refreshBracketProgression}
              />
              </Suspense>
            ) : adminCanReadResource(adminUser, "bracketSchedule.schedule") ? (
              <div className="relative left-1/2 w-[min(100vw-2rem,88rem)] max-w-none -translate-x-1/2">
                <Suspense fallback={<PageLoadingSpinner label="Loading schedule…" />}>
                <SchedulePage
                  state={bracketState}
                  saveCustomSchedule={saveCustomSchedule}
                  teamDraft={teamDraft}
                  approvedRoster={approvedRoster}
                  liveYoutubeUrl={setup.liveYoutubeUrl}
                  onSaveLiveYoutubeUrl={saveLiveYoutubeUrl}
                />
                </Suspense>
              </div>
            ) : null}
          </div>
        )}

        {activePage === "standings" && (
          <Suspense fallback={<PageLoadingSpinner label="Loading standings…" />}>
          <StandingsPage
            standings={state?.standings}
            groupedStandings={state?.groupedStandings}
            teamCount={setup?.teamCount || state?.tournament?.team_count || 0}
            format={state?.tournament?.format}
          />
          </Suspense>
        )}


        {activePage === "users" && (
          <Suspense fallback={<PageLoadingSpinner label="Loading user mgmt…" />}>
            <AdminUsersPage currentUser={adminUser} />
          </Suspense>
        )}
      </section>
      </AdminTournamentProvider>
      </AdminAccessProvider>
      <AppFooter navigate={navigateAdminPage} mode="admin" />
      <ScrollToTopButton />
    </AdminShell>
  );
}

