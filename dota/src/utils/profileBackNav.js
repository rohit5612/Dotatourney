export const PROFILE_BACK_COMMUNITY = Object.freeze({ to: "/community", label: "Community" });
export const PROFILE_BACK_TEAMS = Object.freeze({ to: "/teams", label: "Teams" });

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
