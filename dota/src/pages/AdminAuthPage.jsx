import { useEffect, useState } from "react";
import { api, setAuthToken } from "../lib/api";

export function AdminAuthPage({ onAuthed, inviteToken, darkMode, setDarkMode }) {
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

  const title = inviteToken ? "Accept invite" : hasAdminUsers ? "Sign in" : "Create superadmin";
  const subtitle = inviteToken
    ? "Register with the invited email, then wait for manual approval."
    : hasAdminUsers
      ? "Manage tournaments, registrations, brackets, and league operations."
      : "No admins exist yet. Create the first superadmin account.";

  return (
    <main className="admin-auth">
      <button
        type="button"
        className="admin-auth__theme-btn site-navbar-icon-btn"
        onClick={() => setDarkMode?.((prev) => !prev)}
        aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
        title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
      >
        {darkMode ? "☀" : "☾"}
      </button>
      <div className="admin-glass-panel admin-auth__card">
        <span className="admin-auth__eyebrow">Staff portal</span>
        <h1 className="admin-auth__title">{title}</h1>
        <p className="admin-auth__lead">{subtitle}</p>

        {message ? (
          <p className={`admin-auth__message${message.includes("match") || message.includes("fail") ? " admin-auth__message--error" : ""}`}>
            {message}
          </p>
        ) : null}
        {invite ? <p className="admin-auth__invite-note">Invite for {invite.email}</p> : null}

        <form className="admin-auth__form" onSubmit={submit}>
          {needsRegistration ? (
            <label className="admin-auth__field">
              Full name
              <input
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                required
                autoComplete="name"
              />
            </label>
          ) : null}

          <label className="admin-auth__field">
            Email
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              required
              autoComplete="email"
            />
          </label>

          <label className="admin-auth__field">
            Password
            <div className="admin-auth__password-wrap">
              <input
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                required
                minLength={8}
                autoComplete={needsRegistration ? "new-password" : "current-password"}
              />
              <button
                type="button"
                className="admin-auth__toggle"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          {needsRegistration ? (
            <label className="admin-auth__field">
              Confirm password
              <div className="admin-auth__password-wrap">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={form.confirmPassword}
                  onChange={(event) => setForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="admin-auth__toggle"
                  onClick={() => setShowConfirmPassword((s) => !s)}
                  aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>
          ) : null}

          <button type="submit" className="btn btn-primary btn-block admin-auth__submit">
            {hasAdminUsers && !inviteToken ? "Sign in to staff portal" : title}
          </button>
        </form>
      </div>
    </main>
  );
}
