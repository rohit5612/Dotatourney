import { useEffect, useState } from "react";
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { DashboardActionIcon } from "../../components/player/DashboardActionIcon.jsx";
import {
  RegistrationBody,
  RegistrationLinkagePanel,
  RegistrationPlayerStrip,
  useRegistrationTournament,
} from "../../components/player/RegistrationFlow.jsx";
import { SubstitutePoolHero } from "../../components/player/SubstitutePoolFlow.jsx";
import { roles } from "../../constants/tournament";
import { playerApi } from "../../lib/playerApi";
import { canJoinSubstitutePool } from "./tournamentDisplay.js";

export function PlayerSubstitutePoolPage() {
  const { slug } = useParams();
  const { account, refreshMe } = useOutletContext();
  const navigate = useNavigate();
  const { tournament, loading: tournamentLoading } = useRegistrationTournament(slug);
  const [form, setForm] = useState({
    mmr: "",
    preferredRoles: [],
    location: "",
    phoneNumber: "",
    availability: "",
    notes: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!account) return;
    setForm((current) => ({
      ...current,
      mmr: account.mmr ?? "",
      preferredRoles: account.preferredRoles || [],
      location: account.location || "",
      phoneNumber: account.phoneNumber || "",
    }));
  }, [account]);

  function toggleRole(role) {
    setForm((f) => ({
      ...f,
      preferredRoles: f.preferredRoles.includes(role)
        ? f.preferredRoles.filter((r) => r !== role)
        : [...f.preferredRoles, role],
    }));
  }

  if (!account) return null;

  const poolOpen = tournament ? canJoinSubstitutePool(tournament, account) : false;
  const rolesSelected = form.preferredRoles.length > 0;

  async function onSubmit(e) {
    e.preventDefault();
    if (!poolOpen || !account.eligibleForRegistration || !rolesSelected) return;
    setBusy(true);
    setError("");
    try {
      await playerApi.patchMe({
        mmr: form.mmr === "" ? null : Number(form.mmr),
        preferredRoles: form.preferredRoles,
        location: form.location,
        phoneNumber: form.phoneNumber,
      });
      await refreshMe?.();
      await playerApi.substituteSignup(slug, {
        availability: form.availability,
        notes: form.notes,
      });
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="player-reg">
        <RegistrationBody>
          <section className="player-dash__card player-reg__success">
            <div className="player-reg__success-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <path d="M22 4 12 14.01l-3-3" />
              </svg>
            </div>
            <h1 className="player-dash__hero-title player-reg__success-title">Substitute pool signup received</h1>
            <p className="player-auth__sub">
              Admins will reach out if a roster spot opens for{" "}
              <strong>{tournament?.name || "this tournament"}</strong>.
            </p>
            <div className="player-reg__form-actions player-reg__form-actions--center">
              <Link
                to="/dashboard/tournaments"
                className="player-dash__action player-dash__action--tournaments player-dash__action--lead"
              >
                <DashboardActionIcon name="tournaments" />
                <span>Back to tournaments</span>
              </Link>
              <Link to="/dashboard/history" className="player-dash__action player-dash__action--public">
                <span>View history</span>
              </Link>
            </div>
          </section>
        </RegistrationBody>
      </div>
    );
  }

  return (
    <div className="player-reg">
      <SubstitutePoolHero tournament={tournament} account={account} />
      <RegistrationBody>
        {error ? <div className="player-auth__message player-auth__message--error">{error}</div> : null}

        {!account.eligibleForRegistration ? (
          <section className="player-dash__eligibility-banner" aria-label="Substitute requirements">
            <div className="player-dash__eligibility-copy">
              <p className="player-dash__eligibility-title">Linkage incomplete</p>
              <p className="player-dash__eligibility-sub">
                Verify email and link Steam + Discord before joining the substitute pool.
              </p>
            </div>
            <Link to="/dashboard/settings" className="player-dash__action player-dash__action--edit">
              <span>Complete linkage</span>
            </Link>
          </section>
        ) : null}

        {tournamentLoading ? (
          <div className="player-dash__loading">
            <span className="player-dash__loading-pulse" aria-hidden="true" />
            <p className="player-auth__sub">Loading tournament…</p>
          </div>
        ) : !poolOpen ? (
          <section className="player-dash__card player-dash__section-card">
            <h2 className="player-dash__card-title">Substitute pool not open</h2>
            <p className="player-dash__card-sub">
              The substitute pool opens once the main roster cap is reached and registration closes.
            </p>
            <button
              type="button"
              className="player-dash__action player-dash__action--public"
              onClick={() => navigate("/dashboard/tournaments")}
            >
              <span>Back to tournaments</span>
            </button>
          </section>
        ) : (
          <div className="player-reg__layout" data-tour="substitute-flow">
            <section className="player-dash__card player-dash__section-card player-reg__form-card">
              <header className="player-dash__card-head player-dash__card-head--compact">
                <div className="player-dash__section-title-row">
                  <span className="player-dash__section-icon" aria-hidden="true">
                    <DashboardActionIcon name="edit" />
                  </span>
                  <div>
                    <h2 className="player-dash__card-title">Player details</h2>
                    <p className="player-dash__card-sub">Prefilled from your profile — edit if anything changed</p>
                  </div>
                </div>
              </header>

              <RegistrationPlayerStrip account={account} />

              <form onSubmit={onSubmit} className="player-reg__form">
                <div className="player-dash__settings-form-grid">
                  <div className="player-auth__field">
                    <label htmlFor="sub-mmr">MMR</label>
                    <input
                      id="sub-mmr"
                      type="number"
                      min={0}
                      max={20000}
                      value={form.mmr}
                      onChange={(e) => setForm((f) => ({ ...f, mmr: e.target.value }))}
                      placeholder="e.g. 4500"
                    />
                  </div>
                  <div className="player-auth__field">
                    <label htmlFor="sub-phone">Phone</label>
                    <input
                      id="sub-phone"
                      type="tel"
                      value={form.phoneNumber}
                      onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))}
                      placeholder="Contact number"
                    />
                  </div>
                  <div className="player-auth__field player-reg__field-span">
                    <label htmlFor="sub-location">Location</label>
                    <input
                      id="sub-location"
                      value={form.location}
                      onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                      placeholder="City, country"
                    />
                  </div>
                </div>

                <div className="player-dash__role-block">
                  <p className="player-dash__role-label">Preferred roles</p>
                  <p className="player-reg__field-hint">Select one or more — admins use this for roster review.</p>
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

                <div className="player-dash__settings-form-grid">
                  <div className="player-auth__field player-reg__field-span">
                    <label htmlFor="sub-availability">Availability</label>
                    <input
                      id="sub-availability"
                      value={form.availability}
                      onChange={(e) => setForm((f) => ({ ...f, availability: e.target.value }))}
                      placeholder="e.g. Weeknights after 8pm IST"
                    />
                  </div>
                  <div className="player-auth__field player-reg__field-span">
                    <label htmlFor="sub-notes">Notes for admins</label>
                    <textarea
                      id="sub-notes"
                      rows={3}
                      value={form.notes}
                      onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                      placeholder="Anything else admins should know when assigning subs"
                    />
                  </div>
                </div>

                <div className="player-dash__readonly-strip">
                  <span>Display name: {account.displayName || "—"}</span>
                  <span>Email: {account.email}</span>
                </div>

                <div className="player-reg__form-actions">
                  <button
                    type="submit"
                    className="player-dash__action player-dash__action--tournaments player-dash__action--lead"
                    disabled={busy || !account.eligibleForRegistration || !rolesSelected}
                  >
                    <DashboardActionIcon name="tournaments" />
                    <span>{busy ? "Submitting…" : "Join substitute pool"}</span>
                  </button>
                  <Link to="/dashboard/tournaments" className="player-dash__action player-dash__action--public">
                    <span>Cancel</span>
                  </Link>
                </div>

                {!rolesSelected ? (
                  <p className="player-reg__field-hint player-reg__field-hint--warn">
                    Pick at least one preferred role to continue.
                  </p>
                ) : null}
              </form>
            </section>

            <aside className="player-reg__aside">
              <RegistrationLinkagePanel account={account} />

              <section className="player-dash__card player-dash__section-card player-reg__tips">
                <h2 className="player-dash__card-title">What happens next</h2>
                <ol className="player-reg__tips-list">
                  <li>Your player details are saved and submitted to the substitute pool — no payment required.</li>
                  <li>Admins review the pool when a roster spot needs filling.</li>
                  <li>You may be assigned to a match lineup if selected.</li>
                </ol>
              </section>
            </aside>
          </div>
        )}
      </RegistrationBody>
    </div>
  );
}
