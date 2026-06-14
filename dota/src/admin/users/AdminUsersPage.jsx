import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api.js";
import { AdminGlassPanel } from "../components/AdminGlassPanel.jsx";
import { ConfirmDialog } from "./ConfirmDialog.jsx";
import { InviteMemberModal } from "./InviteMemberModal.jsx";
import { UserAccessDrawer } from "./UserAccessDrawer.jsx";
import { MemberRowActions } from "./MemberActionIcons.jsx";
import {
  countByStatus,
  formatMgmtDate,
  isInactiveStatus,
  memberStatusBadgeClass,
  memberStatusLabel,
  permissionsSummary,
  userInitials,
} from "./userMgmtUtils.js";
import "../../styles/admin-user-mgmt.css";

const STATUS_FILTERS = [
  { id: "all", label: "All members" },
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Active" },
  { id: "inactive", label: "Inactive" },
];

const PAGE_TABS = [
  { id: "members", label: "Team members" },
  { id: "activity", label: "Activity log" },
];

function ToastStack({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div className="user-mgmt-toasts" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`user-mgmt-toast user-mgmt-toast--${toast.tone || "info"}`}>
          <span>{toast.message}</span>
          <button type="button" className="user-mgmt-toast__close" onClick={() => onDismiss(toast.id)} aria-label="Dismiss">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

export function AdminUsersPage({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageTab, setPageTab] = useState("members");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [drawerTab, setDrawerTab] = useState("overview");
  const [toasts, setToasts] = useState([]);
  const [confirm, setConfirm] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const selectedUser = useMemo(() => users.find((user) => user.id === selectedUserId) || null, [users, selectedUserId]);
  const stats = useMemo(() => countByStatus(users), [users]);

  function pushToast(message, tone = "info") {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 5000);
  }

  async function refreshData() {
    const [usersPayload, auditPayload] = await Promise.all([api.getAdminUsers(), api.getAuditLog({ limit: 100 })]);
    setUsers(usersPayload.users);
    setAuditLog(auditPayload.entries || []);
  }

  useEffect(() => {
    if (currentUser?.role !== "superadmin") return undefined;
    let active = true;
    setLoading(true);
    refreshData()
      .catch((error) => pushToast(error.message, "error"))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [currentUser?.role]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((user) => {
      if (statusFilter === "pending" && user.status !== "pending") return false;
      if (statusFilter === "approved" && user.status !== "approved") return false;
      if (statusFilter === "inactive" && !isInactiveStatus(user.status)) return false;
      if (!query) return true;
      const haystack = [user.name, user.email, user.role, user.status, permissionsSummary(user)].join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }, [users, search, statusFilter]);

  function openDrawer(user, tab = "overview") {
    setSelectedUserId(user.id);
    setDrawerTab(tab);
  }

  function closeDrawer() {
    setSelectedUserId("");
    setDrawerTab("overview");
  }

  async function handleInvite(email) {
    const payload = await api.createAdminInvite(email);
    pushToast(
      payload.invite.emailSent ? `Invitation sent to ${email}` : "Invite link created — copy it from the dialog if email is off",
      payload.invite.emailSent ? "success" : "info",
    );
    return { link: payload.invite.link, emailSent: payload.invite.emailSent };
  }

  async function handleSavePermissions(userId, permissions) {
    await api.updateAdminPermissions(userId, permissions);
    await refreshData();
    pushToast("Access permissions saved.", "success");
  }

  async function handleApplyTemplate(userId, permissions, label) {
    await api.updateAdminPermissions(userId, permissions);
    await refreshData();
    pushToast(`${label} template applied and saved.`, "success");
  }

  async function handleUpdateStatus(userId, status) {
    await api.updateAdminStatus(userId, status);
    await refreshData();
    const wasInactive = users.find((u) => u.id === userId)?.status;
    const messages = {
      approved:
        wasInactive === "revoked" || wasInactive === "rejected"
          ? "Member reactivated. Review their tab access."
          : "Member approved. Configure their tab access next.",
      rejected: "Registration rejected.",
      revoked: "Access revoked — member moved to inactive.",
    };
    pushToast(messages[status] || "Status updated.", status === "approved" ? "success" : "info");
    if (status === "approved") {
      setSelectedUserId(userId);
      setDrawerTab("access");
    }
  }

  function promptReactivate(user) {
    const detail = user.status === "revoked" ? "Their access was previously revoked." : "Their registration was previously rejected.";
    setConfirm({
      title: "Reactivate team member?",
      description: `${user.email} will be able to sign in again. ${detail} Review tab access after reactivation.`,
      confirmLabel: "Reactivate",
      onConfirm: async () => {
        await handleUpdateStatus(user.id, "approved");
      },
    });
  }

  async function runConfirm() {
    if (!confirm?.onConfirm) return;
    setConfirmBusy(true);
    try {
      await confirm.onConfirm();
      setConfirm(null);
    } catch (error) {
      pushToast(error.message || "Action failed.", "error");
    } finally {
      setConfirmBusy(false);
    }
  }

  if (currentUser?.role !== "superadmin") {
    return (
      <AdminGlassPanel>
        <p className="text-sm text-muted-foreground">User management is available to the superadmin only.</p>
      </AdminGlassPanel>
    );
  }

  return (
    <div className="user-mgmt">
      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((toast) => toast.id !== id))} />

      <header className="user-mgmt-header">
        <div>
          <p className="user-mgmt-header__eyebrow">Organization</p>
          <h1 className="user-mgmt-header__title">Team access</h1>
          <p className="user-mgmt-header__lead">Invite staff, approve registrations, and control CRUD access per admin tab.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setInviteOpen(true)}>
          Invite member
        </button>
      </header>

      <div className="user-mgmt-stats">
        <div className="user-mgmt-stat">
          <span className="user-mgmt-stat__label">Total members</span>
          <strong className="user-mgmt-stat__value">{stats.total}</strong>
        </div>
        <div className="user-mgmt-stat user-mgmt-stat--warn">
          <span className="user-mgmt-stat__label">Pending review</span>
          <strong className="user-mgmt-stat__value">{stats.pending}</strong>
        </div>
        <div className="user-mgmt-stat user-mgmt-stat--ok">
          <span className="user-mgmt-stat__label">Active</span>
          <strong className="user-mgmt-stat__value">{stats.active}</strong>
        </div>
        <div className="user-mgmt-stat">
          <span className="user-mgmt-stat__label">Inactive</span>
          <strong className="user-mgmt-stat__value">{stats.inactive}</strong>
        </div>
      </div>

      <AdminGlassPanel className="user-mgmt-panel">
        <div className="user-mgmt-panel__tabs" role="tablist" aria-label="User management sections">
          {PAGE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={pageTab === tab.id}
              className={`user-mgmt-panel__tab${pageTab === tab.id ? " user-mgmt-panel__tab--active" : ""}`}
              onClick={() => setPageTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {pageTab === "members" ? (
          <>
            <div className="user-mgmt-toolbar">
              <input
                className="user-mgmt-search"
                type="search"
                placeholder="Search name, email, or access…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="Search team members"
              />
              <div className="user-mgmt-filters" role="group" aria-label="Filter by status">
                {STATUS_FILTERS.map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    className={`user-mgmt-filter${statusFilter === filter.id ? " user-mgmt-filter--active" : ""}`}
                    onClick={() => setStatusFilter(filter.id)}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="user-mgmt-table-wrap">
              <table className="user-mgmt-table">
                <thead>
                  <tr>
                    <th scope="col">Member</th>
                    <th scope="col">Role</th>
                    <th scope="col">Status</th>
                    <th scope="col">Access</th>
                    <th scope="col">Joined</th>
                    <th scope="col" className="user-mgmt-table__actions-col">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="user-mgmt-table__empty">
                        Loading team members…
                      </td>
                    </tr>
                  ) : filteredUsers.length ? (
                    filteredUsers.map((user) => {
                      const isSelf = user.id === currentUser.id;
                      const isSuperadmin = user.role === "superadmin";
                      return (
                        <tr key={user.id} className="user-mgmt-table__row">
                          <td>
                            <button type="button" className="user-mgmt-member" onClick={() => openDrawer(user)}>
                              <span className="user-mgmt-avatar user-mgmt-avatar--sm" aria-hidden="true">
                                {userInitials(user.name, user.email)}
                              </span>
                              <span className="user-mgmt-member__text">
                                <span className="user-mgmt-member__name">{user.name}</span>
                                <span className="user-mgmt-member__email">{user.email}</span>
                              </span>
                            </button>
                          </td>
                          <td>
                            <span className="user-mgmt-badge user-mgmt-badge--role">{user.role}</span>
                          </td>
                          <td>
                            <span className={`user-mgmt-badge ${memberStatusBadgeClass(user.status)}`} title={user.status}>
                              {memberStatusLabel(user.status)}
                            </span>
                          </td>
                          <td className="user-mgmt-table__access">{permissionsSummary(user)}</td>
                          <td className="user-mgmt-table__date">{formatMgmtDate(user.createdAt)}</td>
                          <td className="user-mgmt-table__actions">
                            <MemberRowActions
                              user={user}
                              isSelf={isSelf}
                              isSuperadmin={isSuperadmin}
                              onOpen={openDrawer}
                              onReactivate={promptReactivate}
                            />
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="user-mgmt-table__empty">
                        No members match your search or filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="user-mgmt-table-wrap">
            <table className="user-mgmt-table">
              <thead>
                <tr>
                  <th scope="col">Action</th>
                  <th scope="col">Actor</th>
                  <th scope="col">Target</th>
                  <th scope="col">When</th>
                </tr>
              </thead>
              <tbody>
                {auditLog.length ? (
                  auditLog.map((entry) => (
                    <tr key={entry.id}>
                      <td className="user-mgmt-table__mono">{entry.action}</td>
                      <td>{entry.admin_name || entry.admin_email || "System"}</td>
                      <td>
                        {entry.entity_type
                          ? `${entry.entity_type}${entry.entity_id ? ` · ${entry.entity_id.slice(0, 8)}…` : ""}`
                          : "—"}
                      </td>
                      <td className="user-mgmt-table__date">{formatMgmtDate(entry.created_at)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="user-mgmt-table__empty">
                      No activity recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </AdminGlassPanel>

      <InviteMemberModal open={inviteOpen} onClose={() => setInviteOpen(false)} onInvite={handleInvite} />

      <UserAccessDrawer
        user={selectedUser}
        currentUserId={currentUser.id}
        open={Boolean(selectedUserId)}
        initialTab={drawerTab}
        onClose={closeDrawer}
        onSavePermissions={handleSavePermissions}
        onApplyTemplate={handleApplyTemplate}
        onUpdateStatus={handleUpdateStatus}
        onRequestConfirm={(payload) => setConfirm(payload)}
      />

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title}
        description={confirm?.description}
        confirmLabel={confirm?.confirmLabel}
        cancelLabel={confirm?.cancelLabel || "Cancel"}
        tone={confirm?.tone}
        busy={confirmBusy}
        onCancel={() => setConfirm(null)}
        onConfirm={runConfirm}
      />
    </div>
  );
}
