import { useEffect, useRef, useState } from "react";
import { SiteNavbar } from "../components/navigation/SiteNavbar";
import { AppFooter } from "../components/AppFooter";
import { playerApi, googleAuthStartUrl, getPlayerToken, setPlayerToken } from "../lib/playerApi";
import "../styles/player-auth.css";

function AuthLayout({ children, navigate }) {
  const path = typeof window !== "undefined" ? window.location.pathname : "/";
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <SiteNavbar path={path} navigate={navigate} />
      {children}
      <AppFooter navigate={navigate} mode="public" />
    </div>
  );
}

function GoogleAuthButton({ label, intent = "login" }) {
  const href =
    intent === "signup"
      ? `${googleAuthStartUrl()}?intent=signup`
      : googleAuthStartUrl();
  return (
    <a className="btn btn-secondary w-full text-center" href={href}>
      {label}
    </a>
  );
}

function AuthDivider({ label = "or" }) {
  return (
    <p className="player-auth__sub player-auth__divider" aria-hidden="true">
      {label}
    </p>
  );
}

export function PlayerLoginPage({ navigate }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err) setError(decodeURIComponent(err));
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await playerApi.login({ email, password });
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
    <AuthLayout navigate={navigate}>
      <div className="player-auth">
        <div className="player-auth__card">
          <h1 className="player-auth__title">Player sign in</h1>
          <p className="player-auth__sub">Use your BPCL account for Season 2 registration.</p>
          {error ? <div className="player-auth__message player-auth__message--error">{error}</div> : null}
          <form onSubmit={onSubmit}>
            <div className="player-auth__field">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
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
              <button type="submit" className="btn btn-primary w-full" disabled={loading}>
                {loading ? "Signing in…" : "Sign in"}
              </button>
              <AuthDivider />
              <GoogleAuthButton label="Sign in with Google" intent="login" />
            </div>
          </form>
          <p className="player-auth__sub" style={{ marginTop: "1.5rem" }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate("/forgot-password")}>
              Forgot password
            </button>
            {" · "}
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate("/signup")}>
              Create account
            </button>
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}

export function PlayerSignupPage({ navigate }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");
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
    <AuthLayout navigate={navigate}>
      <div className="player-auth">
        <div className="player-auth__card">
          <h1 className="player-auth__title">Create player account</h1>
          <p className="player-auth__sub">
            Sign up with Google for instant access, or use email and verify before signing in.
          </p>
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary w-full" disabled={loading}>
              {loading ? "Creating…" : "Create account"}
            </button>
          </form>
          <p className="player-auth__sub" style={{ marginTop: "1rem" }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate("/login")}>
              Already have an account?
            </button>
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}

export function PlayerVerifyEmailPage({ navigate }) {
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
    <AuthLayout navigate={navigate}>
      <div className="player-auth">
        <div className="player-auth__card">
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
        </div>
      </div>
    </AuthLayout>
  );
}

export function PlayerAuthCallbackPage({ navigate }) {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const error = params.get("error");
    if (token) {
      setPlayerToken(token);
      navigate("/dashboard");
      return;
    }
    navigate(`/login?error=${encodeURIComponent(error || "Sign-in failed")}`);
  }, [navigate]);

  return (
    <AuthLayout navigate={navigate}>
      <div className="player-auth">
        <div className="player-auth__card">
          <p className="player-auth__sub">Completing sign-in…</p>
        </div>
      </div>
    </AuthLayout>
  );
}

export function PlayerForgotPasswordPage({ navigate }) {
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
    <AuthLayout navigate={navigate}>
      <div className="player-auth">
        <div className="player-auth__card">
          <h1 className="player-auth__title">Forgot password</h1>
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
        </div>
      </div>
    </AuthLayout>
  );
}

export function PlayerResetPasswordPage({ navigate }) {
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
    <AuthLayout navigate={navigate}>
      <div className="player-auth">
        <div className="player-auth__card">
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
        </div>
      </div>
    </AuthLayout>
  );
}

export function PlayerDashboardPage({ navigate }) {
  const [me, setMe] = useState(null);
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
      .then((data) => setMe(data))
      .catch((err) => {
        if (err.status === 401) {
          setPlayerToken("");
          navigate("/login");
          return;
        }
        setError(err.message);
      });
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
    <AuthLayout navigate={navigate}>
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
                You are eligible to register when tournament registration opens (checkout in Phase 3).
              </p>
            ) : (
              <p className="player-auth__sub" style={{ marginTop: "1rem" }}>
                Complete all steps above to register for the next season.
              </p>
            )}
            <p className="player-auth__sub" style={{ marginTop: "1rem" }}>
              BPC coins: {me?.coinBalance ?? 0}
            </p>
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

export function PlayerPublicProfilePage({ navigate, slug }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    playerApi
      .publicAccount(slug)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [slug]);

  return (
    <AuthLayout navigate={navigate}>
      <div className="player-dashboard">
        {error ? <div className="player-auth__message player-auth__message--error">{error}</div> : null}
        {data?.account ? (
          <>
            <h1 className="player-auth__title">{data.account.displayName}</h1>
            <span className="player-dashboard__badge">{data.account.bpcId}</span>
            <p className="player-auth__sub">Full player profile and card — Phase 4.</p>
          </>
        ) : (
          <p className="player-auth__sub">Loading…</p>
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
