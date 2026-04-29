import { useEffect, useState } from "react";
import { api } from "../lib/api";

function statusBadgeClass(status) {
  if (status === "approved") return "border-primary/50 bg-primary/10 text-primary";
  if (status === "pending") return "border-secondary/40 bg-secondary/10 text-secondary";
  if (status === "rejected") return "border-destructive/40 bg-destructive/10 text-destructive";
  if (status === "revoked") return "border-muted-foreground/40 text-muted-foreground";
  return "border-border bg-background text-muted-foreground";
}

export function AdminUsersPage({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [email, setEmail] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [message, setMessage] = useState("");

  async function loadUsers() {
    if (currentUser?.role !== "superadmin") return;
    const payload = await api.getAdminUsers();
    setUsers(payload.users);
  }

  useEffect(() => {
    let active = true;
    if (currentUser?.role === "superadmin") {
      api
        .getAdminUsers()
        .then((payload) => {
          if (active) setUsers(payload.users);
        })
        .catch((error) => {
          if (active) setMessage(error.message);
        });
    }
    return () => {
      active = false;
    };
  }, [currentUser?.role]);

  async function createInvite(event) {
    event.preventDefault();
    setMessage("");
    setInviteLink("");
    try {
      const payload = await api.createAdminInvite(email);
      setInviteLink(payload.invite.link);
      setEmail("");
      if (payload.invite.emailSent) {
        setMessage("An invitation email was sent. The registration link expires in a few hours.");
      } else {
        setMessage("Invite created (email not sent — dev mode). Copy the link below if needed.");
      }
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function updateStatus(userId, status) {
    setMessage("");
    try {
      await api.updateAdminStatus(userId, status);
      await loadUsers();
      setMessage(
        status === "approved"
          ? "User approved — confirmation email sent if mail is configured."
          : status === "rejected"
            ? "User rejected — notification email sent if mail is configured."
            : "Access revoked — user was notified if mail is configured.",
      );
    } catch (error) {
      setMessage(error.message);
    }
  }

  if (currentUser?.role !== "superadmin") {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        User management is available to the superadmin only.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {message ? <p className="rounded-md border border-border bg-card p-2 text-sm text-secondary">{message}</p> : null}
      <form className="rounded-lg border border-border bg-card p-4" onSubmit={createInvite}>
        <h2 className="font-serif text-lg">Invite admin</h2>
        <p className="mt-1 text-sm text-muted-foreground">Sends a styled email with a secure registration link (when SMTP is configured).</p>
        <div className="mt-3 flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
          <input
            className="min-w-0 w-full max-w-md rounded-md border border-input bg-background p-2 sm:flex-1"
            type="email"
            placeholder="admin@email.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <button type="submit" className="btn btn-primary">
            Send invite
          </button>
        </div>
        {inviteLink ? (
          <div className="mt-3 rounded-md border border-border bg-background p-3 text-sm">
            <div className="text-muted-foreground">Invite link (also sent by email when configured)</div>
            <div className="break-all font-mono">{inviteLink}</div>
          </div>
        ) : null}
      </form>
      <section className="space-y-2 rounded-lg border border-border bg-card p-4">
        <h2 className="font-serif text-lg">Administrators</h2>
        <p className="text-sm text-muted-foreground">
          Pending invites appear after someone completes the invite form. Approve or reject them, then use Manage to revoke approved admins.
        </p>
        {users.map((user) => (
          <div
            key={user.id}
            className="flex flex-col gap-3 rounded-md border border-border bg-background p-3 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="font-medium">{user.name}</div>
              <div className="text-muted-foreground">{user.email}</div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="rounded border border-border px-2 py-0.5 text-xs capitalize">{user.role}</span>
                <span className={`rounded border px-2 py-0.5 text-xs capitalize ${statusBadgeClass(user.status)}`}>{user.status}</span>
              </div>
            </div>
            {user.role !== "superadmin" && user.id !== currentUser.id ? (
              <div className="flex flex-wrap items-center gap-2">
                {user.status === "pending" ? (
                  <>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => updateStatus(user.id, "approved")}>
                      Approve
                    </button>
                    <button type="button" className="btn btn-destructive-outline btn-sm" onClick={() => updateStatus(user.id, "rejected")}>
                      Reject
                    </button>
                  </>
                ) : null}
                {user.status === "approved" ? (
                  <details className="relative">
                    <summary className="btn btn-outline btn-sm cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                      Manage
                      <span className="ml-1 text-xs text-muted-foreground">▼</span>
                    </summary>
                    <div className="absolute right-0 z-10 mt-1 w-full min-w-48 rounded-md border border-border bg-card p-1 shadow-xl sm:w-48">
                      <button
                        type="button"
                        className="btn-menu w-full text-destructive hover:text-destructive"
                        onClick={() => {
                          if (window.confirm(`Revoke admin access for ${user.email}? They will be signed out and emailed if SMTP is configured.`)) {
                            updateStatus(user.id, "revoked");
                          }
                        }}
                      >
                        Revoke access
                      </button>
                    </div>
                  </details>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
      </section>
    </div>
  );
}
