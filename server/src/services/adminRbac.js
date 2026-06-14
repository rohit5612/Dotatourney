/** Admin tab CRUD permissions — superadmin has implicit `*`. */

export const CRUD_ACTIONS = ["read", "create", "update", "delete"];

/** Resources grouped for User mgmt UI. `page` maps to AdminConsole tab id. */
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

export function allValidPermissionKeys() {
  const keys = new Set(["*"]);
  for (const resource of listRbacResources()) {
    keys.add(`${resource.id}.*`);
    for (const action of CRUD_ACTIONS) {
      keys.add(permissionKey(resource.id, action));
    }
  }
  return keys;
}

export function normalizeUserPermissions(user) {
  if (!user) return [];
  if (user.role === "superadmin") return ["*"];
  let perms = user.permissions;
  if (typeof perms === "string") {
    try {
      perms = JSON.parse(perms);
    } catch {
      perms = [];
    }
  }
  if (!Array.isArray(perms)) return [];
  return perms.filter(Boolean);
}

export function expandLegacyPermissions(perms) {
  const expanded = new Set(perms);
  for (const legacy of perms) {
    const mapped = LEGACY_PERMISSION_MAP[legacy];
    if (mapped) mapped.forEach((key) => expanded.add(key));
  }
  return [...expanded];
}

export function sanitizePermissionsInput(perms) {
  const valid = allValidPermissionKeys();
  const unique = new Set();
  for (const raw of perms || []) {
    const key = String(raw || "").trim();
    if (!key || !valid.has(key)) continue;
    unique.add(key);
  }
  return [...unique];
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

/** Back-compat for requirePermission('registrations.edit') style checks. */
export function adminHasPermission(user, permission) {
  const perms = expandLegacyPermissions(normalizeUserPermissions(user));
  if (perms.includes("*")) return true;
  if (perms.includes(permission)) return true;
  const mapped = LEGACY_PERMISSION_MAP[permission];
  if (mapped?.length) {
    const writeKeys = mapped.filter((key) => /\.(create|update|delete)$/.test(key));
    const keysToCheck = writeKeys.length ? writeKeys : mapped;
    return keysToCheck.some((key) => perms.includes(key));
  }
  const parts = String(permission).split(".");
  const action = parts[parts.length - 1];
  if (CRUD_ACTIONS.includes(action)) {
    const resourceId = parts.slice(0, -1).join(".");
    return adminCan(user, resourceId, action);
  }
  const [group] = String(permission).split(".");
  return perms.includes(`${group}.*`);
}
