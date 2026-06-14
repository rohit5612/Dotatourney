import {
  ADMIN_RBAC_SECTIONS,
  CRUD_ACTIONS,
  initialPermissionDraft,
  listRbacResources,
  permissionKey,
} from "../../lib/adminRbac.js";

export const PERMISSION_TEMPLATES = {
  viewer: {
    label: "Viewer",
    description: "Read-only access across all admin tabs.",
    build: () => listRbacResources().map((resource) => permissionKey(resource.id, "read")),
  },
  crm_manager: {
    label: "CRM manager",
    description: "Player accounts, registrations, and substitutes.",
    build: () => {
      const keys = [];
      for (const resource of listRbacResources()) {
        if (resource.id.startsWith("playerCrm.")) {
          keys.push(permissionKey(resource.id, "read"), permissionKey(resource.id, "update"));
        }
      }
      return keys;
    },
  },
  tournament_ops: {
    label: "Tournament ops",
    description: "Setup, brackets, schedule, and standings.",
    build: () => {
      const resources = ["setup", "bracketSchedule.brackets", "bracketSchedule.schedule", "standings"];
      const keys = [];
      for (const resourceId of resources) {
        keys.push(permissionKey(resourceId, "read"), permissionKey(resourceId, "update"));
        if (resourceId === "bracketSchedule.brackets") keys.push(permissionKey(resourceId, "create"));
      }
      return keys;
    },
  },
  content_manager: {
    label: "Content manager",
    description: "News, honors, seasons, and cards.",
    build: () => {
      const resources = ["announcements", "honors", "seasons", "cards"];
      const keys = [];
      for (const resourceId of resources) {
        keys.push(permissionKey(resourceId, "read"), permissionKey(resourceId, "update"));
      }
      return keys;
    },
  },
};

export function matrixRows() {
  const rows = [];
  for (const section of ADMIN_RBAC_SECTIONS) {
    if (section.children?.length) {
      rows.push({ kind: "group", id: section.id, label: section.label });
      for (const child of section.children) {
        rows.push({ kind: "resource", id: child.id, label: child.label });
      }
      continue;
    }
    rows.push({ kind: "resource", id: section.id, label: section.label });
  }
  return rows;
}

export function formatMgmtDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function userInitials(name, email) {
  const source = (name || email || "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export function permissionsSummary(user) {
  if (user?.role === "superadmin") return "Full access (superadmin)";
  const perms = initialPermissionDraft(user);
  if (!perms.length) return "No tab access configured";
  const readCount = perms.filter((key) => key.endsWith(".read")).length;
  const writeCount = perms.filter((key) => /\.(create|update|delete)$/.test(key)).length;
  if (writeCount > 0) return `${readCount} tabs · ${writeCount} write actions`;
  return `${readCount} tab${readCount === 1 ? "" : "s"} (view only)`;
}

export function draftsEqual(a, b) {
  const left = [...(a || [])].sort();
  const right = [...(b || [])].sort();
  if (left.length !== right.length) return false;
  return left.every((key, index) => key === right[index]);
}

export function countByStatus(users) {
  return users.reduce(
    (acc, user) => {
      acc.total += 1;
      if (user.status === "pending") acc.pending += 1;
      else if (user.status === "approved") acc.active += 1;
      else if (user.status === "revoked" || user.status === "rejected") acc.inactive += 1;
      return acc;
    },
    { total: 0, pending: 0, active: 0, inactive: 0 },
  );
}

export function isInactiveStatus(status) {
  return status === "revoked" || status === "rejected";
}

export function memberStatusLabel(status) {
  if (status === "approved") return "Active";
  if (status === "pending") return "Pending";
  if (isInactiveStatus(status)) return "Inactive";
  return status;
}

export function memberStatusBadgeClass(status) {
  if (status === "approved") return "user-mgmt-badge--approved";
  if (status === "pending") return "user-mgmt-badge--pending";
  if (isInactiveStatus(status)) return "user-mgmt-badge--inactive";
  return "user-mgmt-badge--role";
}

export function inactiveStatusDetail(status) {
  if (status === "revoked") return "Access was revoked — member cannot sign in.";
  if (status === "rejected") return "Registration was rejected — member cannot sign in.";
  return "";
}

export { CRUD_ACTIONS, initialPermissionDraft, permissionKey, sanitizePermissionDraft } from "../../lib/adminRbac.js";
