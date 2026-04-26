import { useEffect, useState } from "react";
import { api, setAuthToken } from "../lib/api";

export function AdminAuthPage({ onAuthed, inviteToken }) {
  const [hasAdminUsers, setHasAdminUsers] = useState(true);
  const [invite, setInvite] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const state = await api.bootstrapState();
        setHasAdminUsers(state.hasAdminUsers);
        if (inviteToken) {
          const invitePayload = await api.getAdminInvite(inviteToken);
          setInvite(invitePayload.invite);
          setForm((prev) => ({ ...prev, email: invitePayload.invite.email }));
        }
      } catch (error) {
        setMessage(error.message);
      }
    }
    load();
  }, [inviteToken]);

  async function submit(event) {
    event.preventDefault();
    try {
      if (inviteToken) {
        await api.registerAdminInvite(inviteToken, form);
        setMessage("Admin account created. Ask the superadmin to approve your access.");
        return;
      }

      const response = hasAdminUsers ? await api.loginAdmin(form) : await api.bootstrapAdmin(form);
      setAuthToken(response.token);
      onAuthed(response.user);
    } catch (error) {
      setMessage(error.message);
    }
  }

  const title = inviteToken ? "Accept admin invite" : hasAdminUsers ? "Admin login" : "Create superadmin";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
      <form className="w-full max-w-md space-y-4 rounded-lg border border-border bg-card p-5" onSubmit={submit}>
        <div>
          <h1 className="font-serif text-2xl text-primary">{title}</h1>
          <p className="text-sm text-muted-foreground">
            {inviteToken
              ? "Register with the invited email, then wait for manual approval."
              : hasAdminUsers
                ? "Sign in to manage The Forge."
                : "No admins exist yet. Create the first superadmin account."}
          </p>
        </div>
        {message ? <p className="rounded-md border border-border bg-background p-2 text-sm text-secondary">{message}</p> : null}
        {invite ? <p className="text-sm text-muted-foreground">Invite for {invite.email}</p> : null}
        {(!hasAdminUsers || inviteToken) && (
          <label className="block text-sm">
            Name
            <input className="mt-1 w-full rounded-md border border-input bg-background p-2" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} required />
          </label>
        )}
        <label className="block text-sm">
          Email
          <input className="mt-1 w-full rounded-md border border-input bg-background p-2" type="email" value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} required />
        </label>
        <label className="block text-sm">
          Password
          <input className="mt-1 w-full rounded-md border border-input bg-background p-2" type="password" value={form.password} onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))} required minLength={8} />
        </label>
        <button type="submit" className="w-full rounded-md bg-primary px-4 py-2 text-primary-foreground">
          {title}
        </button>
      </form>
    </main>
  );
}
