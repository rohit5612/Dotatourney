import { useEffect, useState } from "react";
import { api } from "../lib/api";

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
    await api.updateAdminStatus(userId, status);
    await loadUsers();
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
        <div className="mt-3 flex flex-wrap gap-2">
          <input className="min-w-72 rounded-md border border-input bg-background p-2" type="email" placeholder="admin@email.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
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
        <h2 className="font-serif text-lg">Admins</h2>
        {users.map((user) => (
          <div key={user.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-background p-3 text-sm">
            <div>
              <div className="font-medium">{user.name}</div>
              <div className="text-muted-foreground">{user.email} - {user.role} - {user.status}</div>
            </div>
            {user.role !== "superadmin" ? (
              <div className="flex gap-2">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => updateStatus(user.id, "approved")}>
                  Approve
                </button>
                <button type="button" className="btn btn-destructive-outline btn-sm" onClick={() => updateStatus(user.id, "revoked")}>
                  Revoke
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </section>
    </div>
  );
}
