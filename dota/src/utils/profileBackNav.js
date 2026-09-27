export const PROFILE_BACK_COMMUNITY = Object.freeze({ to: "/community", label: "Community" });
export const PROFILE_BACK_LEAGUE_ROSTERS = Object.freeze({
  to: "/league?view=rosters",
  label: "Season rosters",
});
/** @deprecated Use PROFILE_BACK_LEAGUE_ROSTERS — /teams redirects to The League. */
export const PROFILE_BACK_TEAMS = PROFILE_BACK_LEAGUE_ROSTERS;

export function resolveProfileBack(locationState) {
  const back = locationState?.profileBack;
  if (typeof back?.to === "string" && back.to && typeof back?.label === "string" && back.label) {
    return back;
  }
  return PROFILE_BACK_COMMUNITY;
}

export function profileNavState(profileBack) {
  return { profileBack };
}
