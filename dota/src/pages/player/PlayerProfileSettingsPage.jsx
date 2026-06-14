import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { DashboardActionIcon } from "../../components/player/DashboardActionIcon.jsx";
import { DashboardNavIcon } from "../../components/player/DashboardNavIcon.jsx";
import { roles } from "../../constants/tournament";
import { playerApi } from "../../lib/playerApi";

const LINKAGE = [
  { key: "emailVerified", label: "Email", detailKey: "email", linkKey: null },
  { key: "steamLinked", label: "Steam", detailKey: "steamPersona", oauth: "steam" },
  { key: "discordLinked", label: "Discord", detailKey: "discordUsername", oauth: "discord" },
];

function LinkageRow({ item, account }) {
  const done = Boolean(account[item.key]);
  const detail = item.detailKey ? account[item.detailKey] : null;

  return (
    <div className={`player-dash__link-row${done ? " is-done" : ""}`}>
      <span className={`player-dash__link-icon${done ? " is-done" : ""}`} aria-hidden="true">
        {done ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" />
          </svg>
        )}
      </span>
      <div className="player-dash__link-copy">
        <span className="player-dash__link-label">{item.label}</span>
        {detail ? <span className="player-dash__link-detail">{detail}</span> : null}
      </div>
      {done ? (
        <span className="player-dash__link-status is-done">Linked</span>
      ) : item.oauth ? (
        <a className="player-dash__action player-dash__action--edit player-dash__action--compact" href={playerApi.oauthStartUrl(item.oauth)}>
          Link
        </a>
      ) : (
        <span className="player-dash__link-status">Required</span>
      )}
    </div>
  );
}

export function PlayerProfileSettingsPage() {
  const { account, refreshMe } = useOutletContext();
  const [form, setForm] = useState({
    displayName: "",
    phoneNumber: "",
    location: "",
    mmr: "",
    preferredRoles: [],
    bio: "",
  });
  const [pwd, setPwd] = useState({ current: "", new: "", confirm: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!account) return;
    setForm({
      displayName: account.displayName || "",
      phoneNumber: account.phoneNumber || "",
      location: account.location || "",
      mmr: account.mmr ?? "",
      preferredRoles: account.preferredRoles || [],
      bio: account.bio || "",
    });
  }, [account]);

  function toggleRole(role) {
    setForm((f) => ({
      ...f,
      preferredRoles: f.preferredRoles.includes(role)
        ? f.preferredRoles.filter((r) => r !== role)
        : [...f.preferredRoles, role],
    }));
  }

  async function saveProfile(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await playerApi.patchMe({
        displayName: form.displayName,
        phoneNumber: form.phoneNumber,
        location: form.location,
        mmr: form.mmr === "" ? null : Number(form.mmr),
        preferredRoles: form.preferredRoles,
        bio: form.bio,
      });
      await refreshMe();
      setMessage("Profile saved.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    if (pwd.new !== pwd.confirm) {
      setError("New passwords do not match");
      return;
    }
    setBusy(true);
    try {
      await playerApi.changePassword({
        currentPassword: account.hasPassword ? pwd.current : undefined,
        newPassword: pwd.new,
      });
      setMessage(account.hasPassword ? "Password updated." : "Password set.");
      setPwd({ current: "", new: "", confirm: "" });
      await refreshMe();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!account) return null;

  const linkageDone = LINKAGE.filter((item) => account[item.key]).length;

  return (
    <div className="player-dash__settings">
      <header className="player-dash__hero player-dash__hero--compact">
        <div className="player-dash__hero-main">
          <div className="player-dash__hero-avatar-wrap">
            {account.steamAvatarUrl ? (
              <img src={account.steamAvatarUrl} alt="" className="player-dash__avatar player-dash__avatar--hero" />
            ) : (
              <div className="player-dash__avatar player-dash__avatar--hero player-dash__avatar--fallback">
                {(account.displayName || "?")[0]}
              </div>
            )}
          </div>
          <div className="player-dash__hero-copy">
            <p className="player-dash__hero-eyebrow">Account</p>
            <h1 className="player-dash__hero-title">Profile settings</h1>
            <div className="player-dash__hero-meta">
              <span className="player-dash__badge">{account.bpcId}</span>
              <span className="player-dash__hero-chip">{linkageDone}/{LINKAGE.length} accounts linked</span>
            </div>
            <p className="player-dash__hero-desc">
              These details prefill tournament registration and your player card.
            </p>
          </div>
        </div>

        <div className="player-dash__hero-actions">
          <Link to={`/player/${account.slug}`} className="player-dash__action player-dash__action--public">
            <DashboardActionIcon name="public" />
            <span>Public profile</span>
          </Link>
        </div>
      </header>

      {message ? <div className="player-auth__message player-auth__message--ok">{message}</div> : null}
      {error ? <div className="player-auth__message player-auth__message--error">{error}</div> : null}

      <div className="player-dash__settings-grid">
        <section className="player-dash__card player-dash__section-card player-dash__section-card--span-2">
          <header className="player-dash__card-head player-dash__card-head--compact">
            <div className="player-dash__section-title-row">
              <span className="player-dash__section-icon" aria-hidden="true">
                <DashboardActionIcon name="edit" />
              </span>
              <div>
                <h2 className="player-dash__card-title">Player profile</h2>
                <p className="player-dash__card-sub">Used for registration and admin review</p>
              </div>
            </div>
          </header>

          <form onSubmit={saveProfile} className="player-dash__settings-form">
            <div className="player-dash__settings-form-grid">
              <div className="player-auth__field">
                <label htmlFor="settings-display-name">Display name</label>
                <input
                  id="settings-display-name"
                  value={form.displayName}
                  onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                />
              </div>
              <div className="player-auth__field">
                <label htmlFor="settings-phone">Phone</label>
                <input
                  id="settings-phone"
                  value={form.phoneNumber}
                  onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))}
                />
              </div>
              <div className="player-auth__field">
                <label htmlFor="settings-location">Location</label>
                <input
                  id="settings-location"
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                />
              </div>
              <div className="player-auth__field">
                <label htmlFor="settings-mmr">MMR</label>
                <input
                  id="settings-mmr"
                  type="number"
                  min={0}
                  max={20000}
                  value={form.mmr}
                  onChange={(e) => setForm((f) => ({ ...f, mmr: e.target.value }))}
                />
              </div>
            </div>

            <div className="player-dash__role-block">
              <p className="player-dash__role-label">Preferred roles</p>
              <div className="player-dash__role-pills">
                {roles.map((role) => (
                  <button
                    key={role}
                    type="button"
                    className={`player-dash__role-pill${form.preferredRoles.includes(role) ? " is-selected" : ""}`}
                    onClick={() => toggleRole(role)}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>

            <div className="player-auth__field">
              <label htmlFor="settings-bio">Bio (private)</label>
              <textarea
                id="settings-bio"
                rows={3}
                value={form.bio}
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
              />
            </div>

            <div className="player-dash__readonly-strip">
              <span>Email: {account.email}</span>
              <span>BPC ID: {account.bpcId}</span>
            </div>

            <button type="submit" className="player-dash__action player-dash__action--tournaments" disabled={busy}>
              Save profile
            </button>
          </form>
        </section>

        <section className="player-dash__card player-dash__section-card" data-tour="linked-accounts">
          <header className="player-dash__card-head player-dash__card-head--compact">
            <div className="player-dash__section-title-row">
              <span className="player-dash__section-icon" aria-hidden="true">
                <DashboardNavIcon name="settings" />
              </span>
              <div>
                <h2 className="player-dash__card-title">Linked accounts</h2>
                <p className="player-dash__card-sub">Required for tournament registration</p>
              </div>
            </div>
          </header>

          <div className="player-dash__link-list">
            {LINKAGE.map((item) => (
              <LinkageRow key={item.key} item={item} account={account} />
            ))}
          </div>
        </section>

        <section className="player-dash__card player-dash__section-card">
          <header className="player-dash__card-head player-dash__card-head--compact">
            <div className="player-dash__section-title-row">
              <span className="player-dash__section-icon player-dash__section-icon--security" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85">
                  <rect x="5" y="11" width="14" height="10" rx="2" />
                  <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                </svg>
              </span>
              <div>
                <h2 className="player-dash__card-title">Security</h2>
                <p className="player-dash__card-sub">
                  {account.hasPassword ? "Change your sign-in password" : "Set a password for email login"}
                </p>
              </div>
            </div>
          </header>

          <p className="player-dash__security-hint">
            <Link to="/forgot-password" className="player-dash__empty-link">
              Forgot password?
            </Link>
          </p>

          <form onSubmit={savePassword} className="player-dash__settings-form">
            {account.hasPassword ? (
              <div className="player-auth__field">
                <label htmlFor="pwd-current">Current password</label>
                <input
                  id="pwd-current"
                  type="password"
                  value={pwd.current}
                  onChange={(e) => setPwd((p) => ({ ...p, current: e.target.value }))}
                  required
                />
              </div>
            ) : null}
            <div className="player-auth__field">
              <label htmlFor="pwd-new">New password (min 8)</label>
              <input
                id="pwd-new"
                type="password"
                minLength={8}
                value={pwd.new}
                onChange={(e) => setPwd((p) => ({ ...p, new: e.target.value }))}
                required
              />
            </div>
            <div className="player-auth__field">
              <label htmlFor="pwd-confirm">Confirm new password</label>
              <input
                id="pwd-confirm"
                type="password"
                minLength={8}
                value={pwd.confirm}
                onChange={(e) => setPwd((p) => ({ ...p, confirm: e.target.value }))}
                required
              />
            </div>
            <button type="submit" className="player-dash__action player-dash__action--edit" disabled={busy}>
              {account.hasPassword ? "Update password" : "Set password"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
