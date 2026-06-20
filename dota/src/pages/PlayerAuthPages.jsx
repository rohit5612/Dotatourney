import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PlayerAreaLayout } from "../components/layout/PlayerAreaLayout.jsx";
import { GoogleIcon } from "../components/icons/GoogleIcon.jsx";
import { PlayerAuthShell } from "../components/player/PlayerAuthShell.jsx";
import { BpclCardRenderer } from "../components/cards/BpclCardRenderer.jsx";
import { BpcCoin } from "../components/coins/BpcCoin.jsx";
import { DashboardCheckout } from "../components/player/DashboardCheckout.jsx";
import { playerApi, googleAuthStartUrl, getPlayerToken, setPlayerToken } from "../lib/playerApi";
import "../styles/player-auth.css";

function AuthLayout({ children, preset = "default", split = true, ...shellProps }) {
  if (!split) {
    return (
      <PlayerAreaLayout mainClassName="player-area-layout__main--centered">{children}</PlayerAreaLayout>
    );
  }

  return (
    <PlayerAreaLayout mainClassName="player-area-layout__main--auth" immersive>
      <PlayerAuthShell preset={preset} {...shellProps}>
        {children}
      </PlayerAuthShell>
    </PlayerAreaLayout>
  );
}

function GoogleAuthButton({ label, intent = "login" }) {
  const href =
    intent === "signup"
      ? `${googleAuthStartUrl()}?intent=signup`
      : googleAuthStartUrl();
  return (
    <a className="btn btn-google w-full" href={href}>
      <GoogleIcon className="player-auth__google-icon" />
      <span>{label}</span>
    </a>
  );
}

function AuthDivider({ label = "or" }) {
  return (
    <div className="player-auth__divider-row" aria-hidden="true">
      <span className="player-auth__divider-line" />
      <span className="player-auth__divider-text">{label}</span>
      <span className="player-auth__divider-line" />
    </div>
  );
}

function AuthFormHeader({ badge, title, sub }) {
  return (
    <header className="player-auth__form-head">
      <span className="player-auth__form-badge">{badge}</span>
      <h1 className="player-auth__title">{title}</h1>
      {sub ? <p className="player-auth__sub player-auth__sub--tight">{sub}</p> : null}
    </header>
  );
}

export function PlayerLoginPage() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");
    const nextPath = next && next.startsWith("/") ? next : "/dashboard";

    if (getPlayerToken()) {
      navigate(nextPath, { replace: true });
      return;
    }

    const err = params.get("error");
    if (err) {
      setError(decodeURIComponent(err));
      const cleanUrl = next ? `/login?next=${encodeURIComponent(next)}` : "/login";
      window.history.replaceState({}, "", cleanUrl);
    }
  }, [navigate]);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await playerApi.login({ identifier, password });
      setPlayerToken(data.token);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
      if (err.code === "EMAIL_NOT_VERIFIED") {
        setError(`${err.message} Use the link in your email or resend from the verification page.`);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout preset="login">
      <AuthFormHeader badge="Secure sign in" title="Sign in" sub="Email, BPC ID, username, or Google." />
      {error ? <div className="player-auth__message player-auth__message--error">{error}</div> : null}
      <form onSubmit={onSubmit}>
        <div className="player-auth__field">
          <label htmlFor="identifier">Email, BPC ID, or username</label>
          <input
            id="identifier"
            type="text"
            required
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
          />
        </div>
        <div className="player-auth__field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="player-auth__actions">
          <button type="submit" className="btn btn-primary player-auth__submit w-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
          <AuthDivider />
          <GoogleAuthButton label="Continue with Google" intent="login" />
        </div>
      </form>
      <div className="player-auth__claim-callout">
        <div className="player-auth__claim-callout-inner">
          <span className="player-auth__claim-badge">Season 1</span>
          <div className="player-auth__claim-copy">
            <p className="player-auth__claim-title">Already on the roster?</p>
            <p className="player-auth__claim-desc">
              Claim your BPC account with the email you registered in Season 1.
            </p>
          </div>
          <button
            type="button"
            className="player-auth__claim-btn"
            onClick={() => navigate("/claim-account")}
          >
            Claim Season 1 account
          </button>
        </div>
      </div>
      <nav className="player-auth__footer-links" aria-label="Account options">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate("/forgot-password")}>
          Forgot password
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate("/signup")}>
          Create account
        </button>
      </nav>
    </AuthLayout>
  );
}

export function PlayerSignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const data = await playerApi.register({ email, password, displayName });
      let msg = data.message;
      if (data.devVerifyUrl) msg += ` Dev link: ${data.devVerifyUrl}`;
      setMessage(msg);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout preset="signup">
      <AuthFormHeader badge="New player" title="Create account" sub="Google for instant access, or email with verification." />
      {error ? <div className="player-auth__message player-auth__message--error">{error}</div> : null}
      {message ? <div className="player-auth__message player-auth__message--ok">{message}</div> : null}
      <div className="player-auth__actions">
        <GoogleAuthButton label="Sign up with Google" intent="signup" />
      </div>
      <AuthDivider label="or sign up with email" />
      <form onSubmit={onSubmit}>
        <div className="player-auth__field">
          <label htmlFor="displayName">Display name</label>
          <input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div className="player-auth__field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="player-auth__field">
          <label htmlFor="password">Password (min 8)</label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="player-auth__field">
          <label htmlFor="confirmPassword">Confirm password</label>
          <input
            id="confirmPassword"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-primary player-auth__submit w-full" disabled={loading}>
          {loading ? "Creating…" : "Create account"}
        </button>
      </form>
      <p className="player-auth__sub player-auth__sub--tight" style={{ marginTop: "1rem", marginBottom: 0 }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate("/login")}>
          Already have an account? Sign in
        </button>
      </p>
    </AuthLayout>
  );
}

export function PlayerVerifyEmailPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("Verifying…");
  const [error, setError] = useState("");
  const [resendEmail, setResendEmail] = useState("");
  const [resendMsg, setResendMsg] = useState("");
  const verifiedRef = useRef(false);

  useEffect(() => {
    if (verifiedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const email = params.get("email") || "";
    if (email) setResendEmail(email);
    if (!token) {
      setError("Missing verification token.");
      setStatus("");
      return;
    }
    playerApi
      .verifyEmail(token, email || undefined)
      .then((data) => {
        verifiedRef.current = true;
        setPlayerToken(data.token);
        setStatus("Email verified! Redirecting to your dashboard…");
        setTimeout(() => navigate("/dashboard"), 1500);
      })
      .catch((err) => {
        setError(err.message);
        setStatus("");
      });
  }, [navigate]);

  async function onResend(e) {
    e.preventDefault();
    setResendMsg("");
    try {
      const data = await playerApi.resendVerification(resendEmail);
      let msg = data.message;
      if (data.devVerifyUrl) msg += ` Dev link: ${data.devVerifyUrl}`;
      setResendMsg(msg);
    } catch (err) {
      setResendMsg(err.message);
    }
  }

  return (
    <AuthLayout>
      <h1 className="player-auth__title">Email verification</h1>
      {error ? <div className="player-auth__message player-auth__message--error">{error}</div> : null}
      {status ? <div className="player-auth__message player-auth__message--ok">{status}</div> : null}
      {error ? (
        <form onSubmit={onResend} style={{ marginTop: "1rem" }}>
          <p className="player-auth__sub">Request a new verification link:</p>
          <div className="player-auth__field">
            <label htmlFor="resend-email">Email</label>
            <input
              id="resend-email"
              type="email"
              required
              value={resendEmail}
              onChange={(e) => setResendEmail(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-secondary w-full">
            Resend verification email
          </button>
          {resendMsg ? <p className="player-auth__sub" style={{ marginTop: "0.75rem" }}>{resendMsg}</p> : null}
        </form>
      ) : null}
    </AuthLayout>
  );
}

export function PlayerAuthCallbackPage() {
  const navigate = useNavigate();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const error = params.get("error");

    if (token) {
      setPlayerToken(token);
      window.history.replaceState({}, "", "/auth/callback");
      playerApi
        .me()
        .then((data) => {
          if (!data.account?.hasPassword) {
            navigate("/set-password", { replace: true });
            return;
          }
          navigate("/dashboard", { replace: true });
        })
        .catch(() => {
          navigate("/dashboard", { replace: true });
        });
      return;
    }

    if (getPlayerToken()) {
      playerApi
        .me()
        .then((data) => {
          navigate(data.account?.hasPassword ? "/dashboard" : "/set-password", { replace: true });
        })
        .catch(() => {
          navigate("/dashboard", { replace: true });
        });
      return;
    }

    navigate(`/login?error=${encodeURIComponent(error || "Sign-in failed")}`, { replace: true });
  }, [navigate]);

  return (
    <AuthLayout>
      <p className="player-auth__sub" style={{ marginBottom: 0 }}>
        Completing sign-in…
      </p>
    </AuthLayout>
  );
}

export function PlayerSetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [account, setAccount] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!getPlayerToken()) {
      navigate("/login?next=" + encodeURIComponent("/set-password"), { replace: true });
      return;
    }
    playerApi
      .me()
      .then((data) => {
        if (data.account?.hasPassword) {
          navigate("/dashboard", { replace: true });
          return;
        }
        setAccount(data.account);
      })
      .catch((err) => {
        if (err.status === 401) {
          setPlayerToken("");
          navigate("/login?next=" + encodeURIComponent("/set-password"), { replace: true });
          return;
        }
        setError(err.message);
      })
      .finally(() => setChecking(false));
  }, [navigate]);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await playerApi.changePassword({ newPassword: password });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <AuthLayout preset="signup" headline="Secure your account" description="One quick step before you continue.">
        <p className="player-auth__sub" style={{ marginBottom: 0 }}>
          Loading…
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      preset="signup"
      headline="Secure your account"
      description="Set a password so you can sign in with email anytime and keep your BPC League account protected."
    >
      <h1 className="player-auth__title">Create your password</h1>
      <p className="player-auth__sub">
        {account?.displayName ? (
          <>
            Welcome, <strong>{account.displayName}</strong>. You signed in with Google — choose a password to finish
            setting up your account.
          </>
        ) : (
          <>You signed in with Google. Choose a password to finish setting up your account.</>
        )}
      </p>
      {error ? <div className="player-auth__message player-auth__message--error">{error}</div> : null}
      <form onSubmit={onSubmit}>
        <div className="player-auth__field">
          <label htmlFor="setPassword">Password (min 8 characters)</label>
          <input
            id="setPassword"
            type="password"
            minLength={8}
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="player-auth__field">
          <label htmlFor="setConfirmPassword">Confirm password</label>
          <input
            id="setConfirmPassword"
            type="password"
            minLength={8}
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-primary w-full" disabled={loading}>
          {loading ? "Saving…" : "Continue to dashboard"}
        </button>
      </form>
    </AuthLayout>
  );
}

export function PlayerForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await playerApi.forgotPassword(email);
      let msg = data.message;
      if (data.devResetUrl) msg += ` Dev: ${data.devResetUrl}`;
      setMessage(msg);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <h1 className="player-auth__title">Forgot password</h1>
      <p className="player-auth__sub">We&apos;ll email you a link to reset your password.</p>
      {message ? <div className="player-auth__message player-auth__message--ok">{message}</div> : null}
      <form onSubmit={onSubmit}>
        <div className="player-auth__field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <button type="submit" className="btn btn-primary w-full" disabled={loading}>
          Send reset link
        </button>
      </form>
    </AuthLayout>
  );
}

export function PlayerResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const token = new URLSearchParams(window.location.search).get("token") || "";

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      const data = await playerApi.resetPassword({ token, password });
      setPlayerToken(data.token);
      setMessage("Password updated. Redirecting…");
      setTimeout(() => navigate("/dashboard"), 1200);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <AuthLayout>
      <h1 className="player-auth__title">Set new password</h1>
      {error ? <div className="player-auth__message player-auth__message--error">{error}</div> : null}
      {message ? <div className="player-auth__message player-auth__message--ok">{message}</div> : null}
      <form onSubmit={onSubmit}>
        <div className="player-auth__field">
          <label htmlFor="password">New password</label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-primary w-full">
          Update password
        </button>
      </form>
    </AuthLayout>
  );
}

export function PlayerClaimAccountPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState("start");
  const [bpcId, setBpcId] = useState("");
  const [email, setEmail] = useState("");
  const [claimToken, setClaimToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("step") !== "verify") return;

    const linkBpcId = params.get("bpcId") || "";
    const linkEmail = params.get("email") || "";
    const token = params.get("token") || "";
    if (!linkBpcId || !linkEmail || !token) {
      setError("Invalid claim link. Request a new email from the form below.");
      setStep("start");
      return;
    }

    const cacheKey = `bpcl:claim-verify:${token}`;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const { claimToken: storedClaimToken, bpcId: storedBpcId, email: storedEmail } =
          JSON.parse(cached);
        if (storedClaimToken) {
          setBpcId(storedBpcId || linkBpcId);
          setEmail(storedEmail || linkEmail);
          setClaimToken(storedClaimToken);
          setStep("password");
          setMessage("Email verified. Create your password to finish claiming your account.");
          window.history.replaceState({}, "", "/claim-account");
          return;
        }
      }
    } catch {
      // ignore corrupt cache
    }

    let active = true;
    setBpcId(linkBpcId);
    setEmail(linkEmail);
    setStep("verifying");
    setLoading(true);
    setError("");

    playerApi
      .claimVerifyFromLink(linkBpcId, linkEmail, token)
      .then((data) => {
        if (!active) return;
        try {
          sessionStorage.setItem(
            cacheKey,
            JSON.stringify({
              claimToken: data.claimToken,
              bpcId: linkBpcId,
              email: linkEmail,
            }),
          );
        } catch {
          // ignore quota errors
        }
        setClaimToken(data.claimToken);
        setStep("password");
        setMessage("Email verified. Create your password to finish claiming your account.");
        window.history.replaceState({}, "", "/claim-account");
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || "Could not verify your claim link.");
        setStep("start");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function onStart(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const data = await playerApi.claimStart({ bpcId, email });
      let msg = data.message;
      if (data.devVerifyUrl) msg += ` Dev link: ${data.devVerifyUrl}`;
      setMessage(msg);
      setStep("pending");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function onSetPassword(e) {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const data = await playerApi.claimSetPassword({ token: claimToken, password });
      setPlayerToken(data.token);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      preset="signup"
      headline="Claim your Season 1 account"
      description="Already played in Season 1? Verify your BPC ID and email to migrate into the new player portal."
    >
      <h1 className="player-auth__title">Claim your account</h1>
      <p className="player-auth__sub">Enter your BPC ID and registered email.</p>
      {error ? <div className="player-auth__message player-auth__message--error">{error}</div> : null}
      {message ? <div className="player-auth__message player-auth__message--ok">{message}</div> : null}

      {step === "start" ? (
        <form onSubmit={onStart}>
          <div className="player-auth__field">
            <label htmlFor="bpcId">BPC ID</label>
            <input id="bpcId" required value={bpcId} onChange={(e) => setBpcId(e.target.value)} placeholder="BPC-042" />
          </div>
          <div className="player-auth__field">
            <label htmlFor="email">Registered email</label>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? "Sending…" : "Send claim link"}
          </button>
        </form>
      ) : null}

      {step === "pending" ? (
        <div className="player-auth__message player-auth__message--ok" role="status">
          <p style={{ margin: 0 }}>{message || "Check your email for a secure link to verify and claim your account."}</p>
          <p className="player-auth__sub player-auth__sub--tight" style={{ marginTop: "0.75rem", marginBottom: 0 }}>
            Open the link in the email — no verification code needed.
          </p>
        </div>
      ) : null}

      {step === "verifying" ? (
        <p className="player-auth__sub" role="status">
          Verifying your claim link…
        </p>
      ) : null}

      {step === "password" ? (
        <form onSubmit={onSetPassword}>
          <div className="player-auth__field">
            <label htmlFor="claimPassword">New password (min 8)</label>
            <input
              id="claimPassword"
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="player-auth__field">
            <label htmlFor="claimConfirmPassword">Confirm password</label>
            <input
              id="claimConfirmPassword"
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? "Saving…" : "Set password & sign in"}
          </button>
        </form>
      ) : null}

      <p className="player-auth__sub" style={{ marginTop: "1rem", marginBottom: 0 }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate("/login")}>
          Back to sign in
        </button>
      </p>
    </AuthLayout>
  );
}

export function PlayerDashboardPage() {
  const navigate = useNavigate();
  const [tournamentSlug, setTournamentSlug] = useState("bpcl");
  const [me, setMe] = useState(null);
  const [team, setTeam] = useState(null);
  const [matches, setMatches] = useState([]);
  const [cardManifest, setCardManifest] = useState(null);
  const [registrationsOpen, setRegistrationsOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenFromLink = params.get("token");
    if (tokenFromLink) {
      setPlayerToken(tokenFromLink);
      window.history.replaceState({}, "", "/dashboard");
    }
    if (!getPlayerToken()) {
      navigate("/login");
      return;
    }
    playerApi
      .me()
      .then((data) => {
        setMe(data);
        if (data.account?.slug) {
          playerApi.publicCard(data.account.slug).then((r) => setCardManifest(r.card || r.manifest)).catch(() => {});
        }
      })
      .catch((err) => {
        if (err.status === 401) {
          setPlayerToken("");
          navigate("/login");
          return;
        }
        setError(err.message);
      });
    playerApi.team().then(setTeam).catch(() => {});
    playerApi.matches().then((r) => setMatches(r.matches || [])).catch(() => {});
    fetch(`${import.meta.env.VITE_API_BASE_URL || "/api"}/public/tournament`)
      .then((r) => r.json())
      .then((d) => {
        setRegistrationsOpen(d?.tournament?.registrations_open === true);
        if (d?.tournament?.slug) setTournamentSlug(d.tournament.slug);
      })
      .catch(() => {});
  }, [navigate]);

  async function logout() {
    try {
      await playerApi.logout();
    } catch {
      // ignore
    }
    setPlayerToken("");
    navigate("/login");
  }

  const account = me?.account;

  return (
    <AuthLayout split={false}>
      <div className="player-dashboard">
        <h1 className="player-auth__title">Player dashboard</h1>
        {error ? <div className="player-auth__message player-auth__message--error">{error}</div> : null}
        {account ? (
          <>
            <span className="player-dashboard__badge">{account.bpcId}</span>
            <p className="player-auth__sub">
              {account.displayName} ·{" "}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(`/player/${account.slug}`)}>
                Public profile
              </button>
            </p>
            <h2 style={{ fontSize: "1.1rem", marginTop: "1.5rem" }}>Registration eligibility</h2>
            <ul className="eligibility-list">
              <li>
                <span>Email verified</span>
                <span className={account.emailVerified ? "done" : "pending"}>
                  {account.emailVerified ? "Done" : "Required"}
                </span>
              </li>
              <li>
                <span>Steam linked</span>
                <span className={account.steamLinked ? "done" : "pending"}>
                  {account.steamLinked ? account.steamPersona || "Done" : "Required"}
                </span>
              </li>
              <li>
                <span>Discord linked</span>
                <span className={account.discordLinked ? "done" : "pending"}>
                  {account.discordLinked ? account.discordUsername || "Done" : "Required"}
                </span>
              </li>
            </ul>
            {!account.steamLinked ? (
              <a className="btn btn-secondary" href={playerApi.oauthStartUrl("steam")}>
                Link Steam
              </a>
            ) : null}
            {!account.discordLinked ? (
              <a className="btn btn-secondary" href={playerApi.oauthStartUrl("discord")} style={{ marginLeft: "0.5rem" }}>
                Link Discord
              </a>
            ) : null}
            {account.eligibleForRegistration ? (
              <p className="player-auth__message player-auth__message--ok" style={{ marginTop: "1.5rem" }}>
                You are eligible to register for the active tournament.
              </p>
            ) : (
              <p className="player-auth__sub" style={{ marginTop: "1rem" }}>
                Complete all steps above to register for the next season.
              </p>
            )}
            <p className="player-auth__sub" style={{ marginTop: "1rem" }}>
              <BpcCoin amount={me?.coinBalance ?? 0} size="sm" />
            </p>

            <DashboardCheckout
              tournamentSlug={tournamentSlug}
              registrationsOpen={registrationsOpen}
              eligible={account.eligibleForRegistration}
            />

            {cardManifest ? (
              <div className="mt-8">
                <h2 style={{ fontSize: "1.1rem" }}>My card</h2>
                <div className="mt-3">
                  <BpclCardRenderer manifest={cardManifest} showMeta={false} />
                </div>
              </div>
            ) : null}

            {team?.teamName ? (
              <div className="mt-8">
                <h2 style={{ fontSize: "1.1rem" }}>My team</h2>
                <p className="player-auth__sub">{team.teamName}</p>
              </div>
            ) : null}

            {matches.length ? (
              <div className="mt-8">
                <h2 style={{ fontSize: "1.1rem" }}>My matches</h2>
                <ul className="eligibility-list">
                  {matches.map((m) => (
                    <li key={m.id}>
                      <span>
                        {m.team1} vs {m.team2}
                        {m.scheduledAt ? ` · ${new Date(m.scheduledAt).toLocaleString()}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <button type="button" className="btn btn-ghost" style={{ marginTop: "2rem" }} onClick={logout}>
              Sign out
            </button>
          </>
        ) : (
          <p className="player-auth__sub">Loading…</p>
        )}
      </div>
    </AuthLayout>
  );
}

export function PlayerPublicProfilePage() {
  const { slug } = useParams();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    playerApi
      .publicProfile(slug)
      .then((data) => setProfile(data.profile))
      .catch((err) => setError(err.message));
  }, [slug]);

  return (
    <AuthLayout split={false}>
      <div className="player-dashboard max-w-2xl">
        {error ? <div className="player-auth__message player-auth__message--error">{error}</div> : null}
        {profile ? (
          <div className="flex flex-wrap gap-6 items-center">
            {profile.steamAvatarUrl ? (
              <img src={profile.steamAvatarUrl} alt="" className="w-24 h-24 rounded-full border border-border" />
            ) : null}
            <div>
              <h1 className="player-auth__title">{profile.displayName}</h1>
              <span className="player-dashboard__badge">{profile.bpcId}</span>
              {profile.steamPersona ? (
                <p className="player-auth__sub mt-3">{profile.steamPersona}</p>
              ) : null}
              {profile.steamProfile ? (
                <a href={profile.steamProfile} className="btn btn-secondary btn-sm mt-4" target="_blank" rel="noreferrer">
                  View Steam profile
                </a>
              ) : null}
            </div>
          </div>
        ) : (
          !error && <p className="player-auth__sub">Loading…</p>
        )}
      </div>
    </AuthLayout>
  );
}

const PLAYER_PATHS = new Set([
  "/login",
  "/signup",
  "/verify-email",
  "/auth/callback",
  "/dashboard",
  "/forgot-password",
  "/reset-password",
  "/claim-account",
]);

export function isPlayerAuthPath(path) {
  if (PLAYER_PATHS.has(path)) return true;
  return /^\/player\/[^/]+$/.test(path);
}

export function PlayerAuthRouter({ path, navigate }) {
  if (path === "/login") return <PlayerLoginPage navigate={navigate} />;
  if (path === "/signup") return <PlayerSignupPage navigate={navigate} />;
  if (path === "/verify-email") return <PlayerVerifyEmailPage navigate={navigate} />;
  if (path === "/auth/callback") return <PlayerAuthCallbackPage navigate={navigate} />;
  if (path === "/dashboard") return <PlayerDashboardPage navigate={navigate} />;
  if (path === "/forgot-password") return <PlayerForgotPasswordPage navigate={navigate} />;
  if (path === "/reset-password") return <PlayerResetPasswordPage navigate={navigate} />;
  const profileMatch = path.match(/^\/player\/([^/]+)$/);
  if (profileMatch) return <PlayerPublicProfilePage navigate={navigate} slug={profileMatch[1]} />;
  return null;
}
