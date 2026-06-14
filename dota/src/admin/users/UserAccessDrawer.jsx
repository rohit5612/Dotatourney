import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock.js";
import { PermissionMatrix } from "./PermissionMatrix.jsx";
import { IconShield, IconUser } from "./MemberActionIcons.jsx";
import {
  PERMISSION_TEMPLATES,
  draftsEqual,
  formatMgmtDate,
  inactiveStatusDetail,
  initialPermissionDraft,
  isInactiveStatus,
  memberStatusBadgeClass,
  memberStatusLabel,
  permissionsSummary,
  userInitials,
  CRUD_ACTIONS,
  permissionKey,
  sanitizePermissionDraft,
} from "./userMgmtUtils.js";

const DRAWER_TABS = [
  { id: "overview", label: "Overview", Icon: IconUser },
  { id: "access", label: "Access", Icon: IconShield },
];

export function UserAccessDrawer({
  user,
  currentUserId,
  open,
  initialTab = "overview",
  onClose,
  onSavePermissions,
  onApplyTemplate,
  onUpdateStatus,
  onRequestConfirm,
}) {
  const [tab, setTab] = useState(initialTab);
  const [draft, setDraft] = useState([]);
  const [savedDraft, setSavedDraft] = useState([]);
  const [saving, setSaving] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);

  useBodyScrollLock(open);

  const isDirty = useMemo(() => !draftsEqual(draft, savedDraft), [draft, savedDraft]);
  const isSuperadmin = user?.role === "superadmin";
  const isSelf = user?.id === currentUserId;
  const canManage = user && !isSuperadmin && !isSelf;

  useEffect(() => {
    if (!user) return;
    const next = initialPermissionDraft(user);
    setDraft(next);
    setSavedDraft(next);
    setTab(initialTab);
  }, [user, initialTab]);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(event) {
      if (event.key === "Escape") requestClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, isDirty]);

  function requestClose() {
    if (isDirty) {
      onRequestConfirm({
        title: "Discard unsaved access changes?",
        description: "Permission changes you made have not been saved yet.",
        confirmLabel: "Discard changes",
        tone: "danger",
        onConfirm: () => onClose?.(),
      });
      return;
    }
    onClose?.();
  }

  function togglePermission(key) {
    setDraft((prev) => {
      const set = new Set(prev);
      if (set.has(key)) set.delete(key);
      else set.add(key);
      return [...set];
    });
  }

  function toggleResource(resourceId, enableAll) {
    setDraft((prev) => {
      const set = new Set(prev);
      for (const action of CRUD_ACTIONS) {
        const key = permissionKey(resourceId, action);
        if (enableAll) set.add(key);
        else set.delete(key);
      }
      return [...set];
    });
  }

  async function savePermissions() {
    if (!user || !canManage) return;
    setSaving(true);
    try {
      const permissions = sanitizePermissionDraft(draft);
      await onSavePermissions(user.id, permissions);
      setSavedDraft(permissions);
      setDraft(permissions);
    } finally {
      setSaving(false);
    }
  }

  function applyTemplate(templateKey) {
    if (!user || !canManage) return;
    const template = PERMISSION_TEMPLATES[templateKey];
    onRequestConfirm({
      title: `Apply “${template.label}” template?`,
      description: `${template.description} This saves immediately and replaces their current access.`,
      confirmLabel: "Apply template",
      onConfirm: async () => {
        const permissions = sanitizePermissionDraft(template.build());
        setDraft(permissions);
        if (onApplyTemplate) {
          await onApplyTemplate(user.id, permissions, template.label);
          setSavedDraft(permissions);
        }
      },
    });
  }

  async function runStatus(status) {
    if (!user || !canManage) return;
    setStatusBusy(true);
    try {
      await onUpdateStatus(user.id, status);
      if (status === "approved") setTab("access");
    } finally {
      setStatusBusy(false);
    }
  }

  function promptStatus(status) {
    let copy;
    if (status === "approved" && isInactiveStatus(user.status)) {
      copy = {
        title: "Reactivate team member?",
        description: `${user.email} will be able to sign in again. ${inactiveStatusDetail(user.status)} Review tab access after reactivation.`,
        confirmLabel: "Reactivate member",
      };
    } else {
      copy = {
        approved: {
          title: "Approve team member?",
          description: `${user.email} will be able to sign in after approval. Configure tab access on the Access tab before they start work.`,
          confirmLabel: "Approve member",
        },
        rejected: {
          title: "Reject registration?",
          description: `${user.email} will not be able to sign in. They will be notified by email if SMTP is configured.`,
          confirmLabel: "Reject member",
          tone: "danger",
        },
        revoked: {
          title: "Revoke admin access?",
          description: `${user.email} will be signed out immediately and moved to inactive. You can reactivate them later.`,
          confirmLabel: "Revoke access",
          tone: "danger",
        },
      }[status];
    }

    onRequestConfirm({
      ...copy,
      onConfirm: () => runStatus(status),
    });
  }

  if (!open || !user) return null;

  return createPortal(
    <div className="user-mgmt-drawer" role="presentation">
      <button type="button" className="user-mgmt-drawer__backdrop" aria-label="Close panel" onClick={requestClose} />
      <aside className="user-mgmt-drawer__panel" role="dialog" aria-modal="true" aria-labelledby="drawer-user-name">
        <header className="user-mgmt-drawer__header">
          <div className="user-mgmt-drawer__profile">
            <span className="user-mgmt-avatar" aria-hidden="true">
              {userInitials(user.name, user.email)}
            </span>
            <div className="min-w-0">
              <h2 id="drawer-user-name" className="user-mgmt-drawer__name">
                {user.name}
              </h2>
              <p className="user-mgmt-drawer__email">{user.email}</p>
              <div className="user-mgmt-drawer__badges">
                <span className="user-mgmt-badge user-mgmt-badge--role">{user.role}</span>
                <span className={`user-mgmt-badge ${memberStatusBadgeClass(user.status)}`} title={user.status}>
                  {memberStatusLabel(user.status)}
                </span>
              </div>
            </div>
          </div>
          <button type="button" className="user-mgmt-drawer__close" onClick={requestClose} aria-label="Close">
            ×
          </button>
        </header>

        {!isSuperadmin && !isSelf ? (
          <div className="user-mgmt-drawer__tabs" role="tablist" aria-label="Member sections">
            {DRAWER_TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                aria-label={item.label}
                title={item.label}
                className={`user-mgmt-drawer__tab${tab === item.id ? " user-mgmt-drawer__tab--active" : ""}`}
                onClick={() => setTab(item.id)}
              >
                <item.Icon />
              </button>
            ))}
          </div>
        ) : null}

        <div className="user-mgmt-drawer__body">
          {isSuperadmin ? (
            <div className="user-mgmt-empty-block">
              <p className="user-mgmt-empty-block__title">Superadmin account</p>
              <p className="user-mgmt-empty-block__text">Superadmins always have full access and manage team permissions from this page.</p>
            </div>
          ) : isSelf ? (
            <div className="user-mgmt-empty-block">
              <p className="user-mgmt-empty-block__title">Your account</p>
              <p className="user-mgmt-empty-block__text">You cannot change your own status or permissions here. Ask another superadmin if updates are needed.</p>
            </div>
          ) : tab === "overview" ? (
            <div className="user-mgmt-drawer__stack">
              {isInactiveStatus(user.status) ? (
                <section className="user-mgmt-callout user-mgmt-callout--inactive">
                  <p className="user-mgmt-callout__title">Inactive member</p>
                  <p className="user-mgmt-callout__text">{inactiveStatusDetail(user.status)} Reactivate to restore staff portal sign-in.</p>
                  <div className="user-mgmt-callout__actions">
                    <button type="button" className="btn btn-primary btn-sm" disabled={statusBusy} onClick={() => promptStatus("approved")}>
                      Reactivate member
                    </button>
                    <button type="button" className="btn btn-outline btn-sm" disabled={statusBusy} onClick={() => setTab("access")}>
                      Review access
                    </button>
                  </div>
                </section>
              ) : null}

              {user.status === "pending" ? (
                <section className="user-mgmt-callout user-mgmt-callout--warn">
                  <p className="user-mgmt-callout__title">Pending approval</p>
                  <p className="user-mgmt-callout__text">
                    Review this registration, approve or reject, then assign tab access on the Access tab.
                  </p>
                  <div className="user-mgmt-callout__actions">
                    <button type="button" className="btn btn-primary btn-sm" disabled={statusBusy} onClick={() => promptStatus("approved")}>
                      Approve member
                    </button>
                    <button type="button" className="btn btn-destructive-outline btn-sm" disabled={statusBusy} onClick={() => promptStatus("rejected")}>
                      Reject
                    </button>
                  </div>
                </section>
              ) : null}

              <section className="user-mgmt-detail-card">
                <h3 className="user-mgmt-detail-card__title">Account details</h3>
                <dl className="user-mgmt-detail-list">
                  <div>
                    <dt>Access summary</dt>
                    <dd>{permissionsSummary(user)}</dd>
                  </div>
                  <div>
                    <dt>Joined</dt>
                    <dd>{formatMgmtDate(user.createdAt)}</dd>
                  </div>
                  <div>
                    <dt>Approved</dt>
                    <dd>{formatMgmtDate(user.approvedAt)}</dd>
                  </div>
                </dl>
              </section>

              {user.status === "approved" ? (
                <section className="user-mgmt-detail-card">
                  <h3 className="user-mgmt-detail-card__title">Danger zone</h3>
                  <p className="user-mgmt-detail-card__text">Revoke access to immediately sign this member out of the staff portal.</p>
                  <button type="button" className="btn btn-destructive-outline btn-sm" disabled={statusBusy} onClick={() => promptStatus("revoked")}>
                    Revoke access
                  </button>
                </section>
              ) : null}

              {user.status === "approved" ? (
                <button type="button" className="btn btn-outline btn-block" onClick={() => setTab("access")}>
                  Configure tab access →
                </button>
              ) : isInactiveStatus(user.status) ? (
                <button type="button" className="btn btn-outline btn-block" onClick={() => setTab("access")}>
                  Prepare access before reactivation →
                </button>
              ) : null}
            </div>
          ) : (
            <div className="user-mgmt-drawer__stack">
              <section className="user-mgmt-detail-card">
                <h3 className="user-mgmt-detail-card__title">Role templates</h3>
                <p className="user-mgmt-detail-card__text">Start from a preset, then fine-tune individual tabs. Changes apply after you save.</p>
                <div className="user-mgmt-template-grid">
                  {Object.entries(PERMISSION_TEMPLATES).map(([key, template]) => (
                    <button key={key} type="button" className="user-mgmt-template-card" onClick={() => applyTemplate(key)}>
                      <span className="user-mgmt-template-card__title">{template.label}</span>
                      <span className="user-mgmt-template-card__desc">{template.description}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="user-mgmt-detail-card">
                <div className="user-mgmt-detail-card__head">
                  <h3 className="user-mgmt-detail-card__title">Tab permissions</h3>
                  {isDirty ? <span className="user-mgmt-pill user-mgmt-pill--warn">Unsaved changes</span> : null}
                </div>
                <p className="user-mgmt-detail-card__text">
                  Grant read / create / update / delete per admin tab. Members only see tabs where they have read access.
                </p>
                <PermissionMatrix draft={draft} onToggle={togglePermission} onToggleResource={toggleResource} />
              </section>
            </div>
          )}
        </div>

        {canManage && tab === "access" ? (
          <footer className="user-mgmt-drawer__footer">
            <button type="button" className="btn btn-outline" disabled={saving} onClick={requestClose}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" disabled={!isDirty || saving} onClick={savePermissions}>
              {saving ? "Saving…" : "Save access"}
            </button>
          </footer>
        ) : null}
      </aside>
    </div>,
    document.body,
  );
}
