import { displayRole, getPlayerRoles, normalizeRole, primaryPlayerRole, sortRolesByDefault } from "./teamPage.js";

const ROLE_ICON_FILES = {
  Carry: "Carry.png",
  Mid: "Mid.png",
  Offlane: "Offlane.png",
  "Soft support": "Soft support.png",
  "Hard support": "hard support.png",
};

export function roleIconSrc(role) {
  const normalized = normalizeRole(role);
  const file = ROLE_ICON_FILES[normalized];
  if (!file) return null;
  return `/roleicons/${encodeURIComponent(file)}`;
}

export function roleIconLabel(role) {
  return displayRole(role);
}

export { getPlayerRoles, sortRolesByDefault };
