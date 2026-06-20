import { useEffect, useState } from "react";
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { DashboardActionIcon } from "../../components/player/DashboardActionIcon.jsx";
import {
  RegistrationBody,
  RegistrationHero,
  RegistrationLinkagePanel,
  RegistrationPlayerStrip,
  RegistrationStepper,
  useRegistrationTournament,
} from "../../components/player/RegistrationFlow.jsx";
import { roles } from "../../constants/tournament";
import { playerApi } from "../../lib/playerApi";
import { isValidPhoneNumber, PHONE_NUMBER_ERROR, sanitizePhoneInput } from "../../lib/phoneNumber";

export function PlayerRegisterDetailsPage() {
  const { slug } = useParams();
  const { account, refreshMe } = useOutletContext();
  const navigate = useNavigate();
  const { tournament, loading: tournamentLoading } = useRegistrationTournament(slug);
  const [form, setForm] = useState({ mmr: "", preferredRoles: [], location: "", phoneNumber: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!account) return;
    setForm({
      mmr: account.mmr ?? "",
      preferredRoles: account.preferredRoles || [],
      location: account.location || "",
      phoneNumber: sanitizePhoneInput(account.phoneNumber || ""),
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

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    if (form.phoneNumber && !isValidPhoneNumber(form.phoneNumber)) {
      setError(PHONE_NUMBER_ERROR);
      setBusy(false);
      return;
    }
    try {
      await playerApi.patchMe({
        mmr: form.mmr === "" ? null : Number(form.mmr),
        preferredRoles: form.preferredRoles,
        location: form.location,
        phoneNumber: form.phoneNumber,
      });
      await refreshMe?.();
      navigate(`/dashboard/checkout/${slug}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!account) return null;

  const rolesSelected = form.preferredRoles.length > 0;

  return (
    <div className="player-reg">
      <RegistrationHero tournament={tournament} account={account} step={1} stepLabel="Step 1 of 2" />
      <RegistrationBody>
      <RegistrationStepper step={1} />

      {error ? <div className="player-auth__message player-auth__message--error">{error}</div> : null}

      {!account.eligibleForRegistration ? (
        <section className="player-dash__eligibility-banner" aria-label="Registration requirements">
          <div className="player-dash__eligibility-copy">
            <p className="player-dash__eligibility-title">Linkage incomplete</p>
            <p className="player-dash__eligibility-sub">
              Verify email and link Steam + Discord before you can register for a tournament.
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
      ) : (
        <div className="player-reg__layout" data-tour="register-flow">
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
                  <label htmlFor="reg-mmr">MMR</label>
                  <input
                    id="reg-mmr"
                    type="number"
                    min={0}
                    max={20000}
                    value={form.mmr}
                    onChange={(e) => setForm((f) => ({ ...f, mmr: e.target.value }))}
                    placeholder="e.g. 4500"
                  />
                </div>
                <div className="player-auth__field">
                  <label htmlFor="reg-phone">Phone</label>
                  <input
                    id="reg-phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    maxLength={10}
                    pattern="\d{10}"
                    value={form.phoneNumber}
                    onChange={(e) => setForm((f) => ({ ...f, phoneNumber: sanitizePhoneInput(e.target.value) }))}
                    placeholder="10-digit mobile number"
                  />
                  <p className="player-reg__field-hint">Digits only — no spaces, dashes, or country code.</p>
                </div>
                <div className="player-auth__field player-reg__field-span">
                  <label htmlFor="reg-location">Location</label>
                  <input
                    id="reg-location"
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
                  <span>{busy ? "Saving…" : "Continue to checkout"}</span>
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
                <li>Review your card bundle options and entry fee on checkout.</li>
                <li>Apply BPC coins (1 coin = ₹1) toward your total.</li>
                <li>Pay the remaining balance to confirm your registration.</li>
              </ol>
            </section>
          </aside>
        </div>
      )}
      </RegistrationBody>
    </div>
  );
}
