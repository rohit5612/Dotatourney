import { useEffect, useState } from "react";
import { api, setAuthToken } from "../lib/api";

export function AdminAuthPage({ onAuthed, inviteToken }) {
  const [hasAdminUsers, setHasAdminUsers] = useState(true);
  const [invite, setInvite] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const needsRegistration = !hasAdminUsers || Boolean(inviteToken);

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
    setMessage("");
    if (needsRegistration) {
      if (form.password !== form.confirmPassword) {
        setMessage("Passwords do not match.");
        return;
      }
    }
    try {
      if (inviteToken) {
        await api.registerAdminInvite(inviteToken, {
          name: form.name,
          email: form.email,
          password: form.password,
        });
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
                ? "Sign in to manage Bharat Pro Circuit League (BPC League)."
                : "No admins exist yet. Create the first superadmin account."}
          </p>
        </div>
        {message ? <p className="rounded-md border border-border bg-background p-2 text-sm text-secondary">{message}</p> : null}
        {invite ? <p className="text-sm text-muted-foreground">Invite for {invite.email}</p> : null}
        {needsRegistration ? (
          <label className="block text-sm">
            Name
            <input
              className="mt-1 w-full rounded-md border border-input bg-background p-2"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
          </label>
        ) : null}
        <label className="block text-sm">
          Email
          <input
            className="mt-1 w-full rounded-md border border-input bg-background p-2"
            type="email"
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            required
          />
        </label>
        <label className="block text-sm">
          Password
          <div className="relative mt-1">
            <input
              className="w-full rounded-md border border-input bg-background py-2 pl-2 pr-14"
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
              required
              minLength={8}
              autoComplete={needsRegistration ? "new-password" : "current-password"}
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              tabIndex={-1}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </label>
        {needsRegistration ? (
          <label className="block text-sm">
            Confirm password
            <div className="relative mt-1">
              <input
                className="w-full rounded-md border border-input bg-background py-2 pl-2 pr-14"
                type={showConfirmPassword ? "text" : "password"}
                value={form.confirmPassword}
                onChange={(event) => setForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                required
                minLength={8}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setShowConfirmPassword((s) => !s)}
                aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                tabIndex={-1}
              >
                {showConfirmPassword ? "Hide" : "Show"}
              </button>
            </div>
          </label>
        ) : null}
        <button type="submit" className="btn btn-primary btn-block">
          {title}
        </button>
      </form>
    </main>
  );
}
