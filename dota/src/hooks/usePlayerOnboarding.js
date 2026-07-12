import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { canJoinSubstitutePool } from "../pages/player/tournamentDisplay.js";

const STORAGE_PREFIX = "bpcl-player-tour-";

export const TOUR_KEYS = {
  dashboard: "dashboard",
  tournaments: "tournaments",
  settings: "settings",
  history: "history",
  register: "register",
};

export function isTourComplete(key) {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(`${STORAGE_PREFIX}${key}`) === "1";
}

export function markTourComplete(key) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`${STORAGE_PREFIX}${key}`, "1");
}

export function isProfileComplete(account) {
  if (!account) return false;
  return Boolean(
    account.displayName?.trim() &&
      account.mmr != null &&
      Array.isArray(account.preferredRoles) &&
      account.preferredRoles.length > 0
  );
}

export const CORE_SETUP_TASK_IDS = ["email", "steam", "discord"];

export function buildSetupTasks(account, tournaments = [], registrations = []) {
  if (!account) return [];

  const hasMainRegistration = tournaments.some((t) => {
    const status = (t.registrationStatus || "").toLowerCase();
    return status === "approved" || status === "pending";
  });

  const substituteAvailable = tournaments.some((t) => canJoinSubstitutePool(t, account));
  const rejectedSubstituteAvailable = tournaments.some((t) => {
    const status = (t.registrationStatus || "").toLowerCase();
    return status === "rejected" && canJoinSubstitutePool(t, account);
  });
  const hasSubstitute = registrations.some((r) => r.substitute);

  const tasks = [
    {
      id: "email",
      label: "Verify email",
      done: Boolean(account.emailVerified),
      href: "/dashboard/settings",
      tier: "core",
      required: true,
    },
    {
      id: "steam",
      label: "Link Steam",
      done: Boolean(account.steamLinked),
      oauth: account.steamLinked ? null : "steam",
      tier: "core",
      required: true,
    },
    {
      id: "discord",
      label: "Link Discord",
      done: Boolean(account.discordLinked),
      oauth: account.discordLinked ? null : "discord",
      tier: "core",
      required: true,
    },
    {
      id: "profile",
      label: "Update player profile",
      done: isProfileComplete(account),
      href: "/dashboard/settings",
      tier: "next",
      required: false,
      hint: "Recommended — speeds up registration, or fill in when you sign up",
    },
    {
      id: "register",
      label: "Register for a tournament",
      done: hasMainRegistration,
      href: "/dashboard/tournaments",
      tier: "next",
      required: false,
    },
  ];

  if ((substituteAvailable && !hasSubstitute && !hasMainRegistration) || (rejectedSubstituteAvailable && !hasSubstitute)) {
    tasks.push({
      id: "substitute",
      label: "Join substitute pool",
      done: hasSubstitute,
      href: "/dashboard/tournaments",
      tier: "next",
      required: false,
    });
  }

  return tasks;
}

export function coreSetupTasks(tasks) {
  return tasks.filter((task) => task.tier === "core");
}

export function nextSetupTasks(tasks) {
  return tasks.filter((task) => task.tier === "next");
}

export function setupProgress(tasks, { tier = "core" } = {}) {
  const scoped = tier === "all" ? tasks : tasks.filter((t) => t.tier === tier);
  const required = scoped.filter((t) => t.required !== false);
  const done = required.filter((t) => t.done).length;
  return { done, total: required.length, pct: required.length ? Math.round((done / required.length) * 100) : 100 };
}

const DASHBOARD_TOUR_STEPS = [
  {
    id: "welcome",
    title: "Welcome to your dashboard",
    body: "Your home base for the season — player card, BPC coins, team roster, and match schedule all live on the overview.",
    placement: "center",
  },
  {
    id: "checklist",
    title: "Complete setup",
    body: "Verify email and link Steam and Discord to unlock registration. Profile and tournament sign-up live in Next steps once linkage is done.",
    target: "[data-tour='setup-checklist']",
    placement: "bottom",
  },
  {
    id: "coins",
    title: "BPC coins",
    body: "Track your BPC coin balance in the sidebar and Wallet page. Coins are credited for circuit activity and shown on your overview stats.",
    target: "[data-tour='wallet-balance']",
    placement: "right",
  },
  {
    id: "matches",
    title: "Matches & substitutes",
    body: "When your team is scheduled, upcoming and past matches appear here. Expand a match to view lineups. If you cannot play, request a substitute with a reason — admins assign someone from the approved pool.",
    target: "[data-tour='matches-panel']",
    placement: "left",
  },
  {
    id: "tournaments",
    title: "Tournaments",
    body: "Open Tournaments to register for the main roster. If the season roster is full, join the substitute pool to be available for individual match cover.",
    target: "[data-tour='nav-tournaments']",
    placement: "right",
  },
  {
    id: "team",
    title: "Your team",
    body: "After registration is approved, your squad card and roster context appear here.",
    target: "[data-tour='team-panel']",
    placement: "top",
  },
  {
    id: "card",
    title: "Player card",
    body: "Your season identity card — shared on your public profile once issued.",
    target: "[data-tour='card-pedestal']",
    placement: "right",
  },
  {
    id: "settings",
    title: "Profile settings",
    body: "Add MMR, roles, and bio. Manage linked accounts and keep your registration details up to date.",
    target: "[data-tour='nav-settings']",
    placement: "right",
  },
];

const PAGE_TOUR_STEPS = {
  [TOUR_KEYS.tournaments]: {
    title: "Registration vs substitute pool",
    body: "Register now puts you on the main tournament roster while sign-ups are open. Join substitute pool is for when the roster cap is reached mid-season — no entry fee, and admins assign subs for specific matches only.",
    target: "[data-tour='tourney-list']",
    placement: "top",
  },
  [TOUR_KEYS.settings]: {
    title: "Linked accounts",
    body: "Connect Steam and Discord — required before you can register for any tournament.",
    target: "[data-tour='linked-accounts']",
    placement: "bottom",
  },
  [TOUR_KEYS.history]: {
    title: "Your circuit record",
    body: "Season placements, team drafts, and every registration live here once you compete.",
    target: "[data-tour='history-sections']",
    placement: "top",
  },
  [TOUR_KEYS.register]: {
    title: "Registration checkout",
    body: "Confirm your details and preview your player card before completing payment.",
    target: "[data-tour='register-flow']",
    placement: "top",
  },
};

function resolveTourKey(pathname) {
  if (pathname === "/dashboard" || pathname === "/dashboard/") return TOUR_KEYS.dashboard;
  if (pathname.startsWith("/dashboard/tournaments")) return TOUR_KEYS.tournaments;
  if (pathname.startsWith("/dashboard/settings")) return TOUR_KEYS.settings;
  if (pathname.startsWith("/dashboard/history")) return TOUR_KEYS.history;
  if (pathname.startsWith("/dashboard/register/")) return TOUR_KEYS.register;
  return null;
}

export function usePlayerOnboarding({ enabled = true } = {}) {
  const { pathname } = useLocation();
  const [activeTour, setActiveTour] = useState(null);
  const [stepIndex, setStepIndex] = useState(0);

  const tourKey = useMemo(() => resolveTourKey(pathname), [pathname]);

  const steps = useMemo(() => {
    if (activeTour === TOUR_KEYS.dashboard) return DASHBOARD_TOUR_STEPS;
    if (activeTour && PAGE_TOUR_STEPS[activeTour]) {
      const step = PAGE_TOUR_STEPS[activeTour];
      return [{ id: activeTour, ...step }];
    }
    return [];
  }, [activeTour]);

  const currentStep = steps[stepIndex] || null;

  useEffect(() => {
    if (!enabled || !tourKey || isTourComplete(tourKey)) return undefined;

    const timer = window.setTimeout(() => {
      setActiveTour((current) => {
        if (current) return current;
        return tourKey;
      });
      setStepIndex(0);
    }, 450);

    return () => window.clearTimeout(timer);
  }, [enabled, tourKey, pathname]);

  const dismissTour = useCallback(() => {
    if (activeTour) markTourComplete(activeTour);
    setActiveTour(null);
    setStepIndex(0);
  }, [activeTour]);

  const nextStep = useCallback(() => {
    if (stepIndex < steps.length - 1) {
      setStepIndex((i) => i + 1);
      return;
    }
    dismissTour();
  }, [dismissTour, stepIndex, steps.length]);

  const prevStep = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  const skipTour = useCallback(() => {
    dismissTour();
  }, [dismissTour]);

  const restartDashboardTour = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(`${STORAGE_PREFIX}${TOUR_KEYS.dashboard}`);
    }
    setActiveTour(TOUR_KEYS.dashboard);
    setStepIndex(0);
  }, []);

  return {
    activeTour,
    currentStep,
    stepIndex,
    steps,
    tourOpen: Boolean(activeTour && currentStep),
    nextStep,
    prevStep,
    skipTour,
    restartDashboardTour,
    setupComplete: (tasks) => setupProgress(tasks).done === setupProgress(tasks).total,
  };
}
