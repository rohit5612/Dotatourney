import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock.js";

export function InviteMemberModal({ open, onClose, onInvite }) {
  const [email, setEmail] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(event) {
      if (event.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setEmail("");
      setInviteLink("");
      setEmailSent(false);
      setError("");
      setCopied(false);
      setBusy(false);
    }
  }, [open]);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = await onInvite(email.trim());
      setInviteLink(result.link);
      setEmailSent(result.emailSent);
      setEmail("");
    } catch (err) {
      setError(err.message || "Invite failed.");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  if (!open) return null;

  return createPortal(
    <div className="user-mgmt-modal" role="presentation">
      <button type="button" className="user-mgmt-modal__backdrop" aria-label="Close dialog" onClick={onClose} />
      <div className="user-mgmt-modal__panel" role="dialog" aria-modal="true" aria-labelledby="invite-title">
        <div className="user-mgmt-modal__head">
          <div>
            <h2 id="invite-title" className="user-mgmt-modal__title">
              Invite team member
            </h2>
            <p className="user-mgmt-modal__lead">
              Sends a secure registration link by email when SMTP is configured. You can also copy the link manually.
            </p>
          </div>
          <button type="button" className="user-mgmt-modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {inviteLink ? (
          <div className="user-mgmt-invite-success">
            <p className="user-mgmt-invite-success__title">
              {emailSent ? "Invitation email sent" : "Invite link created"}
            </p>
            <p className="user-mgmt-invite-success__hint">
              {emailSent
                ? "The member should complete registration, then you approve them and assign tab access."
                : "Email is not configured — copy the link below and share it securely."}
            </p>
            <div className="user-mgmt-invite-success__link">
              <code>{inviteLink}</code>
            </div>
            <div className="user-mgmt-modal__actions">
              <button type="button" className="btn btn-outline" onClick={copyLink}>
                {copied ? "Copied" : "Copy link"}
              </button>
              <button type="button" className="btn btn-primary" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <form className="user-mgmt-modal__form" onSubmit={submit}>
            {error ? <p className="user-mgmt-banner user-mgmt-banner--error">{error}</p> : null}
            <label className="user-mgmt-field">
              Work email
              <input
                type="email"
                placeholder="name@organization.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoFocus
              />
            </label>
            <p className="user-mgmt-field-hint">
              After they register, review the pending member, approve access, then configure CRUD permissions per tab.
            </p>
            <div className="user-mgmt-modal__actions">
              <button type="button" className="btn btn-outline" disabled={busy} onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? "Sending…" : "Send invitation"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
