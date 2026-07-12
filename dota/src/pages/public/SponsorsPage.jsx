import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  HiOutlineBuildingOffice2,
  HiOutlineGlobeAlt,
  HiOutlineMegaphone,
  HiOutlineUser,
  HiOutlineUserGroup,
} from "react-icons/hi2";
import { PUBLIC_CONTACT_EMAIL } from "../../constants/legal.js";
import { SITE_BRAND_SHORT } from "../../constants/siteMeta.js";
import {
  MIN_SPONSOR_AMOUNT_RUPEES,
  SPONSOR_AMOUNT_PRESETS,
  SPONSOR_BENEFITS,
  SPONSOR_NEXT_STEPS,
  SPONSOR_PAGE_COPY,
} from "../../constants/sponsorPitch.js";
import { usePublicTournament } from "../../context/PublicTournamentContext.jsx";
import { api, pollSponsorPaid } from "../../lib/api.js";
import { isValidPhoneNumber, PHONE_NUMBER_ERROR, sanitizePhoneInput } from "../../lib/phoneNumber.js";
import { PageLoadingSpinner } from "../../components/PageLoadingSpinner.jsx";

const CashfreeGatewayModal = lazy(() =>
  import("../../components/payment/CashfreeGatewayModal.jsx").then((m) => ({
    default: m.CashfreeGatewayModal,
  })),
);

const BENEFIT_ICONS = {
  discord: HiOutlineUserGroup,
  stream: HiOutlineMegaphone,
  branding: HiOutlineGlobeAlt,
};

const FLOW_STEP_LABELS = {
  otp: "Step 1 of 2 — Verify email",
  payment: "Step 2 of 2 — Payment",
  done: "Sponsorship confirmed",
};

function formatRupees(amount) {
  return `₹${Number(amount).toLocaleString("en-IN")}`;
}

function SponsorField({ label, children }) {
  return (
    <label className="sponsors-page__field">
      <span className="sponsors-page__label">{label}</span>
      {children}
    </label>
  );
}

function SponsorsFlowModal({ open, step, title, onClose, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event) => {
      if (event.key === "Escape") event.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="sponsors-flow-modal" role="dialog" aria-modal="true" aria-labelledby="sponsors-flow-title">
      <div className="sponsors-flow-modal__backdrop" aria-hidden="true" />
      <div className="sponsors-flow-modal__panel">
        <header className="sponsors-flow-modal__head">
          <div>
            <p className="sponsors-flow-modal__step-label">{FLOW_STEP_LABELS[step] || ""}</p>
            <h2 id="sponsors-flow-title" className="sponsors-flow-modal__title">
              {title}
            </h2>
          </div>
          <button type="button" className="sponsors-flow-modal__close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="sponsors-flow-modal__body">{children}</div>
      </div>
    </div>
  );
}

export function SponsorsPage() {
  const { event } = usePublicTournament();
  const discordUrl = event?.tournament?.discord_url || "https://discord.gg/sV2PhYc6A3";
  const [searchParams] = useSearchParams();
  const resumeOrderId = searchParams.get("orderId")?.trim() || "";

  const [step, setStep] = useState("form");
  const [flowModalOpen, setFlowModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [devOtpHint, setDevOtpHint] = useState("");
  const [contributionId, setContributionId] = useState("");
  const [confirmedAmount, setConfirmedAmount] = useState(null);
  const [otp, setOtp] = useState("");
  const [gateway, setGateway] = useState(null);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [resumeLoading, setResumeLoading] = useState(Boolean(resumeOrderId));

  const [form, setForm] = useState({
    entityType: "person",
    name: "",
    phone: "",
    email: "",
    amountMode: "preset",
    presetAmount: 1000,
    customAmount: "",
  });

  const resolvedAmount = useMemo(() => {
    if (form.amountMode === "custom") {
      const value = Number(form.customAmount);
      return Number.isInteger(value) ? value : null;
    }
    return form.presetAmount;
  }, [form.amountMode, form.customAmount, form.presetAmount]);

  const displayNameLabel = form.entityType === "org" ? "Company name" : "Your name";
  const displayAmount = confirmedAmount ?? resolvedAmount ?? 0;
  const flowModalVisible = flowModalOpen && step !== "form";

  useEffect(() => {
    import("../../lib/cashfreeCheckout.js").then((m) => m.loadCashfreeScript()).catch(() => {});
  }, []);

  useEffect(() => {
    if (!resumeOrderId) {
      setResumeLoading(false);
      return;
    }

    let active = true;
    setResumeLoading(true);
    setMessage("");

    api
      .getSponsorCheckoutStatus(resumeOrderId)
      .then((status) => {
        if (!active) return;
        setContributionId(status.contributionId);
        if (status.amountRupees) setConfirmedAmount(status.amountRupees);
        setForm((prev) => ({
          ...prev,
          entityType: status.entityType === "org" ? "org" : "person",
          name: status.name || prev.name,
          email: status.email || prev.email,
          amountMode: "preset",
          presetAmount: status.amountRupees || prev.presetAmount,
        }));
        if (status.status === "paid" || status.flowStage === "paid") {
          setStep("done");
          setFlowModalOpen(true);
        } else if (status.flowStage === "awaiting_payment") {
          setStep("payment");
          setFlowModalOpen(true);
        } else if (status.flowStage === "awaiting_otp") {
          setStep("otp");
          setFlowModalOpen(true);
        } else {
          setStep("form");
          setMessage("This sponsorship session could not be resumed. Start again below.");
        }
      })
      .catch(() => {
        if (!active) return;
        setMessage("Could not resume your sponsorship session. Start again below.");
        setStep("form");
      })
      .finally(() => {
        if (active) setResumeLoading(false);
      });

    return () => {
      active = false;
    };
  }, [resumeOrderId]);

  function validateForm() {
    if (!form.name.trim()) {
      return form.entityType === "org" ? "Company name is required." : "Name is required.";
    }
    if (!form.phone.trim()) return "Phone number is required.";
    if (!isValidPhoneNumber(form.phone)) return PHONE_NUMBER_ERROR;
    if (!form.email.trim()) return "Email is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return "Enter a valid email address.";
    if (form.amountMode === "custom" && !form.customAmount.trim()) return "Enter a custom sponsor amount.";
    if (!resolvedAmount || resolvedAmount < MIN_SPONSOR_AMOUNT_RUPEES) {
      return `Sponsor amount must be at least ${formatRupees(MIN_SPONSOR_AMOUNT_RUPEES)}.`;
    }
    return "";
  }

  function closeFlowModal() {
    setFlowModalOpen(false);
    setMessage("");
    if (step === "done") {
      setStep("form");
      setOtp("");
      setGateway(null);
      setContributionId("");
      setConfirmedAmount(null);
      window.history.replaceState({}, "", "/sponsors");
      setForm({
        entityType: "person",
        name: "",
        phone: "",
        email: "",
        amountMode: "preset",
        presetAmount: 1000,
        customAmount: "",
      });
    }
  }

  async function onRequestOtp(event) {
    event.preventDefault();
    const err = validateForm();
    if (err) {
      setMessage(err);
      return;
    }

    setBusy(true);
    setMessage("");
    setDevOtpHint("");
    try {
      const res = await api.requestSponsorOtp({
        entityType: form.entityType,
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        amountRupees: resolvedAmount,
      });
      if (res.devOtp) setDevOtpHint(String(res.devOtp));
      if (res.contributionId) setContributionId(res.contributionId);
      setStep("otp");
      setFlowModalOpen(true);
    } catch (error) {
      setMessage(error.message || "Could not send verification email.");
    } finally {
      setBusy(false);
    }
  }

  async function onVerifyOtp(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const res = await api.verifySponsorOtp({
        email: form.email.trim(),
        otp: otp.trim(),
      });
      setContributionId(res.contributionId || res.contribution?.id || "");
      if (res.contribution?.amountRupees) setConfirmedAmount(res.contribution.amountRupees);
      setOtp("");
      setStep("payment");
    } catch (error) {
      setMessage(error.message || "Invalid or expired code.");
    } finally {
      setBusy(false);
    }
  }

  async function onContinueToPayment() {
    setBusy(true);
    setMessage("");
    try {
      const checkout = await api.createSponsorCheckout({ email: form.email.trim() });
      setContributionId(checkout.contributionId);
      if (!checkout.paymentSessionId) {
        throw new Error("Payment session unavailable. Try again.");
      }
      setGateway({
        paymentSessionId: checkout.paymentSessionId,
        mode: checkout.cashfreeMode || "sandbox",
        orderId: checkout.contributionId,
      });
    } catch (error) {
      setMessage(error.message || "Could not start payment.");
    } finally {
      setBusy(false);
    }
  }

  async function onGatewaySettled(result) {
    setGateway(null);
    const orderId = contributionId || gateway?.orderId;
    if (!orderId) return;

    if (result?.error || result?.paymentDetails?.paymentStatus === "FAILED") {
      setMessage("Payment was not completed. You can try again when ready.");
      return;
    }

    setConfirmingPayment(true);
    try {
      const status = await pollSponsorPaid(orderId);
      if (status?.status === "paid" || status?.flowStage === "paid") {
        if (status.amountRupees) setConfirmedAmount(status.amountRupees);
        setStep("done");
        setMessage("");
        window.history.replaceState({}, "", `/sponsors?orderId=${encodeURIComponent(orderId)}`);
      } else {
        setMessage(
          "We could not confirm your payment yet. If money was deducted, wait a minute and refresh — or check your email.",
        );
      }
    } finally {
      setConfirmingPayment(false);
    }
  }

  return (
    <div className="sponsors-page-layout">
      <div className="sponsors-page__mesh" aria-hidden="true" />

      <section className="sponsors-page__hero-band" aria-labelledby="sponsors-page-title">
        <div className="sponsors-page__hero-inner">
          <p className="sponsors-page__eyebrow">{SPONSOR_PAGE_COPY.eyebrow}</p>
          <h1 id="sponsors-page-title" className="sponsors-page__hero-title">
            {SPONSOR_PAGE_COPY.title}
          </h1>
          <p className="sponsors-page__hero-lead">{SPONSOR_PAGE_COPY.lead}</p>
        </div>
      </section>

      <div className="sponsors-page">
        <div className="sponsors-page__form-col">
          <section className="sponsors-glass sponsors-page__form-panel sponsors-page__form-panel--primary" aria-live="polite">
            {resumeLoading ? (
              <PageLoadingSpinner label="Loading sponsorship…" compact />
            ) : (
              <form className="sponsors-page__form" onSubmit={onRequestOtp}>
                <header className="sponsors-page__form-header">
                  <h2 className="sponsors-page__form-title">{SPONSOR_PAGE_COPY.formTitle}</h2>
                  <p className="sponsors-page__form-lead">{SPONSOR_PAGE_COPY.formLead}</p>
                </header>

                {message && !flowModalVisible ? (
                  <p className="sponsors-page__message sponsors-page__message--error">{message}</p>
                ) : null}

                <div className="sponsors-page__entity-toggle" role="group" aria-label="Sponsor type">
                  <button
                    type="button"
                    className={`sponsors-page__entity-btn${
                      form.entityType === "person" ? " sponsors-page__entity-btn--active" : ""
                    }`}
                    onClick={() => setForm((prev) => ({ ...prev, entityType: "person" }))}
                  >
                    <HiOutlineUser aria-hidden="true" className="sponsors-page__entity-icon" />
                    Individual
                  </button>
                  <button
                    type="button"
                    className={`sponsors-page__entity-btn${
                      form.entityType === "org" ? " sponsors-page__entity-btn--active" : ""
                    }`}
                    onClick={() => setForm((prev) => ({ ...prev, entityType: "org" }))}
                  >
                    <HiOutlineBuildingOffice2 aria-hidden="true" className="sponsors-page__entity-icon" />
                    Organisation
                  </button>
                </div>

                <div className="sponsors-page__form-fields">
                <SponsorField label={displayNameLabel}>
                  <input
                    className="sponsors-page__input"
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    required
                    autoComplete={form.entityType === "org" ? "organization" : "name"}
                    placeholder={form.entityType === "org" ? "Acme Gaming Pvt Ltd" : "Rohit Sharma"}
                  />
                </SponsorField>

                <SponsorField label="Phone number">
                  <input
                    className="sponsors-page__input"
                    value={form.phone}
                    onChange={(e) => setForm((prev) => ({ ...prev, phone: sanitizePhoneInput(e.target.value) }))}
                    inputMode="numeric"
                    required
                    autoComplete="tel"
                    placeholder="10-digit mobile number"
                  />
                </SponsorField>

                <SponsorField label="Email">
                  <input
                    className="sponsors-page__input"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                    required
                    autoComplete="email"
                    placeholder="you@company.com"
                  />
                </SponsorField>

                <fieldset className="sponsors-page__field sponsors-page__field--amount">
                  <legend className="sponsors-page__label">Sponsor amount</legend>
                  <div className="sponsors-page__amounts">
                    {SPONSOR_AMOUNT_PRESETS.map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        className={`sponsors-page__amount-badge${
                          form.amountMode === "preset" && form.presetAmount === amount
                            ? " sponsors-page__amount-badge--selected"
                            : ""
                        }`}
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            amountMode: "preset",
                            presetAmount: amount,
                            customAmount: "",
                          }))
                        }
                      >
                        {formatRupees(amount)}
                      </button>
                    ))}
                    <button
                      type="button"
                      className={`sponsors-page__amount-badge${
                        form.amountMode === "custom" ? " sponsors-page__amount-badge--selected" : ""
                      }`}
                      onClick={() => setForm((prev) => ({ ...prev, amountMode: "custom" }))}
                    >
                      Custom
                    </button>
                  </div>
                  {form.amountMode === "custom" ? (
                    <input
                      className="sponsors-page__input"
                      type="number"
                      min={MIN_SPONSOR_AMOUNT_RUPEES}
                      step={1}
                      placeholder={`Min ${formatRupees(MIN_SPONSOR_AMOUNT_RUPEES)}`}
                      value={form.customAmount}
                      onChange={(e) => setForm((prev) => ({ ...prev, customAmount: e.target.value }))}
                      required
                    />
                  ) : (
                    <p className="sponsors-page__amount-selected">
                      Selected: <strong>{formatRupees(resolvedAmount || 0)}</strong>
                    </p>
                  )}
                </fieldset>
                </div>

                <button type="submit" className="sponsors-page__cta" disabled={busy}>
                  {busy ? "Sending code…" : "Send verification code"}
                </button>
              </form>
            )}
          </section>
        </div>

        <aside className="sponsors-page__perks-col" aria-label="Sponsor benefits">
          <div className="sponsors-page__perks-head">
            <p className="sponsors-page__perks-kicker">What you get</p>
            <h2 className="sponsors-page__perks-title">Partner perks</h2>
          </div>
          <div className="sponsors-page__benefits">
            {SPONSOR_BENEFITS.map((benefit) => {
              const Icon = BENEFIT_ICONS[benefit.id] || HiOutlineMegaphone;
              return (
                <article key={benefit.id} className="sponsors-glass sponsors-page__benefit">
                  <span className="sponsors-page__benefit-icon">
                    <Icon aria-hidden="true" style={{ width: "1.1rem", height: "1.1rem" }} />
                  </span>
                  <h3 className="sponsors-page__benefit-title">{benefit.title}</h3>
                  <p className="sponsors-page__benefit-copy">{benefit.copy}</p>
                </article>
              );
            })}
          </div>
        </aside>
      </div>

      <SponsorsFlowModal
        open={flowModalVisible}
        step={step}
        title={
          step === "otp"
            ? "Check your email"
            : step === "payment"
              ? "Complete your sponsorship"
              : `Thank you, ${form.name.trim() || "sponsor"}`
        }
        onClose={closeFlowModal}
      >
        {step === "otp" ? (
          <form className="sponsors-flow-modal__glass sponsors-glass" onSubmit={onVerifyOtp}>
            <p className="sponsors-page__form-lead">
              We sent a 6-digit code to <strong>{form.email}</strong>. Check spam or Promotions if it does not arrive
              within a few minutes.
            </p>
            {devOtpHint ? (
              <p className="sponsors-page__dev-hint">
                Dev mode: use OTP <code>{devOtpHint}</code> (email send skipped).
              </p>
            ) : null}
            {message ? <p className="sponsors-page__message sponsors-page__message--error">{message}</p> : null}
            <SponsorField label="Verification code">
              <input
                className="sponsors-page__input"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                placeholder="6-digit code"
              />
            </SponsorField>
            <button type="submit" className="sponsors-page__cta" disabled={busy}>
              {busy ? "Verifying…" : "Verify & continue"}
            </button>
          </form>
        ) : null}

        {step === "payment" ? (
          <div className="sponsors-flow-modal__glass sponsors-glass">
            <p className="sponsors-page__form-lead">Your email is verified. Complete payment to activate your perks.</p>
            {message ? <p className="sponsors-page__message sponsors-page__message--error">{message}</p> : null}
            <div className="sponsors-flow-modal__summary">
              <p>
                <strong>{form.name}</strong>
                <br />
                {form.entityType === "org" ? "Organisation" : "Individual"} · {form.email}
                <br />
                Amount: <strong>{formatRupees(displayAmount)}</strong>
              </p>
            </div>
            {confirmingPayment ? (
              <PageLoadingSpinner label="Confirming payment…" compact />
            ) : (
              <button
                type="button"
                className="sponsors-page__cta"
                disabled={busy || Boolean(gateway)}
                onClick={() => void onContinueToPayment()}
              >
                {busy ? "Opening checkout…" : "Continue to payment"}
              </button>
            )}
          </div>
        ) : null}

        {step === "done" ? (
          <div className="sponsors-flow-modal__glass sponsors-glass" style={{ textAlign: "center" }}>
            <div className="sponsors-page__success-badge" aria-hidden="true">
              ✓
            </div>
            <p className="sponsors-page__form-lead">
              Payment of <strong>{formatRupees(displayAmount)}</strong> received. Welcome to the {SITE_BRAND_SHORT}{" "}
              partner circle.
            </p>

            <div className="sponsors-page__next-steps" style={{ textAlign: "left" }}>
              <h3 className="sponsors-page__next-steps-title">Next steps</h3>
              <ol className="sponsors-page__next-steps-list">
                {SPONSOR_NEXT_STEPS.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
              <div className="sponsors-page__next-steps-links">
                <a className="sponsors-page__link-chip" href={`mailto:${PUBLIC_CONTACT_EMAIL}`}>
                  Email {PUBLIC_CONTACT_EMAIL}
                </a>
                <a className="sponsors-page__link-chip" href={discordUrl} target="_blank" rel="noreferrer">
                  Open Discord
                </a>
              </div>
            </div>

            <div className="sponsors-flow-modal__cta-row" style={{ marginTop: "1.1rem" }}>
              <Link to="/seasons" className="sponsors-flow-modal__ghost-btn">
                View seasons
              </Link>
              <button type="button" className="sponsors-page__cta" onClick={closeFlowModal}>
                Done
              </button>
            </div>
          </div>
        ) : null}
      </SponsorsFlowModal>

      {gateway ? (
        <Suspense fallback={null}>
          <CashfreeGatewayModal
            open
            paymentSessionId={gateway.paymentSessionId}
            mode={gateway.mode}
            onClose={() => setGateway(null)}
            onSettled={onGatewaySettled}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
