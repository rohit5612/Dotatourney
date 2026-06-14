/** Client mirror of server admin RBAC — keep in sync with server/src/services/adminRbac.js */

export const CRUD_ACTIONS = ["read", "create", "update", "delete"];

export const ADMIN_RBAC_SECTIONS = [
  { id: "setup", label: "Setup", page: "setup" },
  {
    id: "playerCrm",
    label: "Player CRM",
    page: "playerCrm",
    children: [
      { id: "playerCrm.accounts", label: "Player accounts" },
      { id: "playerCrm.registrations", label: "Registrations" },
      { id: "playerCrm.substitutes", label: "Substitutes" },
    ],
  },
  { id: "teams", label: "Teams", page: "teams" },
  { id: "cards", label: "Cards & commerce", page: "cards" },
  { id: "announcements", label: "News", page: "announcements" },
  { id: "honors", label: "Honors", page: "honors" },
  { id: "seasons", label: "Seasons", page: "seasons" },
  {
    id: "bracketSchedule",
    label: "Bracket / Schedule",
    page: "bracketSchedule",
    children: [
      { id: "bracketSchedule.brackets", label: "Brackets" },
      { id: "bracketSchedule.schedule", label: "Schedule" },
    ],
  },
  { id: "standings", label: "Standings", page: "standings" },
];

export const LEGACY_PERMISSION_MAP = {
  "registrations.view": ["playerCrm.registrations.read"],
  "registrations.edit": ["playerCrm.registrations.read", "playerCrm.registrations.update"],
  "registrations.approve": ["playerCrm.registrations.update", "playerCrm.substitutes.update"],
  "coins.grant": ["playerCrm.accounts.update"],
  "tournament.publish": ["setup.update"],
  "bracket.generate": ["bracketSchedule.brackets.create"],
  "bracket.result": ["bracketSchedule.brackets.update"],
  "schedule.edit": ["bracketSchedule.schedule.update"],
  "honors.view": ["honors.read"],
  "honors.edit": ["honors.read", "honors.update"],
  "news.edit": ["announcements.read", "announcements.update"],
  "cards.approve": ["cards.update"],
  "seasons.edit": ["seasons.read", "seasons.update"],
};

export function listRbacResources() {
  const rows = [];
  for (const section of ADMIN_RBAC_SECTIONS) {
    if (section.children?.length) {
      for (const child of section.children) rows.push(child);
    } else {
      rows.push({ id: section.id, label: section.label });
    }
  }
  return rows;
}

export function permissionKey(resourceId, action) {
  return `${resourceId}.${action}`;
}

function normalizeUserPermissions(user) {
  if (!user) return [];
  if (user.role === "superadmin") return ["*"];
  const perms = user.permissions;
  return Array.isArray(perms) ? perms.filter(Boolean) : [];
}

function expandLegacyPermissions(perms) {
  const expanded = new Set(perms);
  for (const legacy of perms) {
    const mapped = LEGACY_PERMISSION_MAP[legacy];
    if (mapped) mapped.forEach((key) => expanded.add(key));
  }
  return [...expanded];
}

export function initialPermissionDraft(user) {
  if (!user || user.role === "superadmin") return ["*"];
  const perms = Array.isArray(user.permissions) ? user.permissions.filter(Boolean) : [];
  return expandLegacyPermissions(perms).filter((key) => key !== "*" && !(key in LEGACY_PERMISSION_MAP));
}

export function sanitizePermissionDraft(perms) {
  const valid = new Set();
  for (const resource of listRbacResources()) {
    for (const action of CRUD_ACTIONS) {
      valid.add(permissionKey(resource.id, action));
    }
  }
  return [...new Set((perms || []).filter((key) => valid.has(key)))];
}

export function adminCan(user, resourceId, action) {
  const perms = expandLegacyPermissions(normalizeUserPermissions(user));
  if (perms.includes("*")) return true;
  const key = permissionKey(resourceId, action);
  if (perms.includes(key)) return true;
  if (perms.includes(`${resourceId}.*`)) return true;
  return false;
}

export function adminCanReadResource(user, resourceId) {
  return adminCan(user, resourceId, "read");
}

export function adminPageResources(pageId) {
  const section = ADMIN_RBAC_SECTIONS.find((s) => s.page === pageId);
  if (!section) return [];
  if (section.children?.length) return section.children.map((c) => c.id);
  return [section.id];
}

export function adminCanReadPage(user, pageId) {
  if (pageId === "users") return user?.role === "superadmin";
  return adminPageResources(pageId).some((resourceId) => adminCanReadResource(user, resourceId));
}

export function adminCanWritePage(user, pageId) {
  if (user?.role === "superadmin") return true;
  return adminPageResources(pageId).some(
    (resourceId) =>
      adminCan(user, resourceId, "create") ||
      adminCan(user, resourceId, "update") ||
      adminCan(user, resourceId, "delete"),
  );
}

export function filterAdminPages(pages, user) {
  return (pages || []).filter((page) => adminCanReadPage(user, page));
}

export function buildAdminAccess(user) {
  const isSuperadmin = user?.role === "superadmin";
  return {
    user,
    isSuperadmin,
    can: (resourceId, action) => adminCan(user, resourceId, action),
    canRead: (resourceId) => adminCanReadResource(user, resourceId),
    canCreate: (resourceId) => adminCan(user, resourceId, "create"),
    canUpdate: (resourceId) => adminCan(user, resourceId, "update"),
    canDelete: (resourceId) => adminCan(user, resourceId, "delete"),
    canReadPage: (pageId) => adminCanReadPage(user, pageId),
    canWritePage: (pageId) => adminCanWritePage(user, pageId),
  };
}
