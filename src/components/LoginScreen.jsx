import React, { useState } from "react";
import { Auth, getSupaKey, isSupaConfigured, setSupaKey } from "../lib/supabase.js";
import BrandSplash, { GroundControlMark } from "./BrandSplash.jsx";
import "./authExperience.css";

function Icon({ name }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };

  if (name === "mail") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M4 6.5h16v11H4zM4.5 7l7.5 6 7.5-6" /></svg>;
  }
  if (name === "lock") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><rect {...common} x="5" y="10" width="14" height="10" rx="2" /><path {...common} d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>;
  }
  if (name === "user") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><circle {...common} cx="12" cy="8" r="4" /><path {...common} d="M4.5 20c.8-4.3 3.3-6.5 7.5-6.5s6.7 2.2 7.5 6.5" /></svg>;
  }
  if (name === "key") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><circle {...common} cx="8" cy="15" r="4" /><path {...common} d="m11 12 8-8M15 8l2 2M18 5l2 2" /></svg>;
  }
  if (name === "eye") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle {...common} cx="12" cy="12" r="2.5" /></svg>;
  }
  if (name === "eyeOff") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="m3 3 18 18M10.7 6.1A10 10 0 0 1 12 6c6 0 9.5 6 9.5 6a16.2 16.2 0 0 1-2.2 2.8M6.2 6.2C3.8 8 2.5 12 2.5 12s3.5 6 9.5 6a10 10 0 0 0 3.1-.5M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>;
  }
  if (name === "shield") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M12 3 5 6v5c0 4.7 2.6 8 7 10 4.4-2 7-5.3 7-10V6l-7-3Z" /><path {...common} d="m9 12 2 2 4-4" /></svg>;
  }
  if (name === "alert") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M12 3 2.8 20h18.4L12 3Z" /><path {...common} d="M12 9v5M12 17.5h.01" /></svg>;
  }
  if (name === "check") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><circle {...common} cx="12" cy="12" r="9" /><path {...common} d="m8 12 2.5 2.5L16 9" /></svg>;
  }
  if (name === "route") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><circle {...common} cx="6" cy="18" r="2" /><circle {...common} cx="18" cy="6" r="2" /><path {...common} d="M8 18h3a3 3 0 0 0 3-3V9a3 3 0 0 1 3-3" /></svg>;
  }
  if (name === "pulse") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M3 12h4l2.2-5 4.2 10 2.2-5H21" /></svg>;
  }
  if (name === "chart") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>;
  }
  return null;
}

function Alert({ type, children }) {
  return (
    <div className={`gc-auth-alert ${type === "success" ? "is-success" : "is-error"}`}>
      <Icon name={type === "success" ? "check" : "alert"} />
      <span>{children}</span>
    </div>
  );
}

function Capability({ icon, title, text }) {
  return (
    <div className="gc-auth-capability">
      <Icon name={icon} />
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

export default function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [keyInput, setKeyInput] = useState(() => getSupaKey() || "");
  const [keySet, setKeySet] = useState(() => isSupaConfigured());

  function switchMode(nextMode) {
    setMode(nextMode);
    setError("");
    setMessage("");
  }

  function saveKey(event) {
    event.preventDefault();
    const key = keyInput.trim();
    if (key.length < 20) {
      setError("Paste the complete Supabase anon key to connect this workspace.");
      return;
    }
    setSupaKey(key);
    setKeySet(true);
    setError("");
    setMessage("Workspace connected. You can now sign in.");
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!keySet) {
      setError("Connect the workspace before signing in.");
      return;
    }
    if (!email.trim()) {
      setError("Enter your email address.");
      return;
    }
    if (mode !== "reset" && !password) {
      setError("Enter your password.");
      return;
    }
    if (mode === "signup" && password.length < 6) {
      setError("Your password must contain at least six characters.");
      return;
    }

    setLoading(true);

    if (mode === "reset") {
      const response = await Auth.resetPassword(email.trim());
      setLoading(false);
      if (response && response.error) {
        setError(response.error);
        return;
      }
      setMessage("Password reset email sent. Check your inbox.");
      return;
    }

    const response = mode === "signup"
      ? await Auth.signUp(email.trim(), password, displayName.trim())
      : await Auth.signIn(email.trim(), password);

    setLoading(false);

    if (!response || response.error) {
      setError(response ? response.error : "Ground Control could not complete the request.");
      return;
    }

    if (mode === "signup" && !response.access_token) {
      setMessage("Account created. Confirm your email, then sign in.");
      setMode("signin");
      return;
    }

    if (!response.access_token) {
      setError("The sign-in response was incomplete. Please try again.");
      return;
    }

    Auth.saveSession(response);
    setLaunching(true);
    window.setTimeout(() => onLogin(response), 1250);
  }

  if (launching) {
    return <BrandSplash message="Opening Mission Control" />;
  }

  const isReset = mode === "reset";
  const isSignup = mode === "signup";

  return (
    <main className="gc-auth-page">
      <div className="gc-grid-field" aria-hidden="true" />
      <div className="gc-auth-ambient gc-auth-ambient-one" aria-hidden="true" />
      <div className="gc-auth-ambient gc-auth-ambient-two" aria-hidden="true" />
      <div className="gc-auth-version">Platform Core v1.0</div>

      <section className="gc-auth-story" aria-label="Ground Control platform introduction">
        <div>
          <div className="gc-auth-brand">
            <GroundControlMark className="gc-auth-mark" />
            <div className="gc-auth-wordmark">
              <span>GROUND</span>
              <strong>CONTROL</strong>
              <small>OPERATIONS PLATFORM</small>
            </div>
          </div>

          <div className="gc-auth-copy">
            <div className="gc-auth-eyebrow">Grassroots sport, under control</div>
            <h1>The operating system for <span>matchday.</span></h1>
            <p>
              Plan the weekend, predict operational pressure and guide every decision
              from one intelligent command centre.
            </p>
          </div>

          <div className="gc-auth-capabilities" aria-label="Platform capabilities">
            <Capability icon="route" title="Build with confidence" text="Fixtures, pitches and timings aligned automatically." />
            <Capability icon="pulse" title="See pressure early" text="Parking, officials and weather risks surfaced before matchday." />
            <Capability icon="chart" title="Prove your impact" text="Turn club operations into grant-ready evidence." />
          </div>
        </div>

        <div className="gc-auth-story-footer">
          <span className="gc-live-dot" aria-hidden="true" />
          <span>Platform services online</span>
          <span>•</span>
          <span>Secure club workspace</span>
        </div>
      </section>

      <section className="gc-auth-panel-wrap" aria-label="Account access">
        <div className="gc-auth-panel">
          <header className="gc-auth-panel-header">
            <div className="gc-auth-secure"><Icon name="shield" /> Secure workspace access</div>
            <h2>{!keySet ? "Connect Ground Control" : isReset ? "Reset your password" : isSignup ? "Create your account" : "Welcome back"}</h2>
            <p className="gc-auth-panel-subtitle">
              {!keySet
                ? "Complete the one-time platform connection for this device."
                : isReset
                  ? "We will send a secure recovery link to your inbox."
                  : isSignup
                    ? "Create the account that will manage your club workspace."
                    : "Sign in to open Mission Control and prepare the next matchday."}
            </p>
          </header>

          {!keySet ? (
            <form className="gc-auth-setup" onSubmit={saveKey}>
              {error && <Alert type="error">{error}</Alert>}
              {message && <Alert type="success">{message}</Alert>}

              <div className="gc-auth-setup-card">
                <strong>One-time workspace connection</strong>
                <p>Your platform administrator provides this key. It is stored only on this device.</p>
              </div>

              <label className="gc-auth-field">
                <span className="gc-auth-field-label">Supabase anon key</span>
                <span className="gc-auth-input-wrap">
                  <Icon name="key" />
                  <input
                    className="gc-auth-input is-mono"
                    type="password"
                    autoComplete="off"
                    placeholder="eyJ..."
                    value={keyInput}
                    onChange={(event) => setKeyInput(event.target.value)}
                  />
                </span>
              </label>

              <button className="gc-auth-submit" type="submit">Connect workspace</button>
              <div className="gc-auth-key-note">For production deployments this connection can be supplied securely through the environment configuration.</div>
            </form>
          ) : (
            <>
              {!isReset && (
                <div className="gc-auth-tabs" role="tablist" aria-label="Account access options">
                  <button
                    className={`gc-auth-tab ${mode === "signin" ? "is-active" : ""}`}
                    type="button"
                    role="tab"
                    aria-selected={mode === "signin"}
                    onClick={() => switchMode("signin")}
                  >
                    Sign in
                  </button>
                  <button
                    className={`gc-auth-tab ${mode === "signup" ? "is-active" : ""}`}
                    type="button"
                    role="tab"
                    aria-selected={mode === "signup"}
                    onClick={() => switchMode("signup")}
                  >
                    Create account
                  </button>
                </div>
              )}

              <form className="gc-auth-form" onSubmit={submit}>
                {error && <Alert type="error">{error}</Alert>}
                {message && <Alert type="success">{message}</Alert>}

                {isSignup && (
                  <label className="gc-auth-field">
                    <span className="gc-auth-field-label">Your name</span>
                    <span className="gc-auth-input-wrap">
                      <Icon name="user" />
                      <input
                        className="gc-auth-input"
                        type="text"
                        autoComplete="name"
                        placeholder="e.g. Andrew Manville"
                        value={displayName}
                        onChange={(event) => setDisplayName(event.target.value)}
                      />
                    </span>
                  </label>
                )}

                <label className="gc-auth-field">
                  <span className="gc-auth-field-label">Email address</span>
                  <span className="gc-auth-input-wrap">
                    <Icon name="mail" />
                    <input
                      className="gc-auth-input"
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      placeholder="you@yourclub.co.uk"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                  </span>
                </label>

                {!isReset && (
                  <label className="gc-auth-field">
                    <span className="gc-auth-field-label">Password</span>
                    <span className="gc-auth-input-wrap">
                      <Icon name="lock" />
                      <input
                        className="gc-auth-input"
                        type={showPassword ? "text" : "password"}
                        autoComplete={isSignup ? "new-password" : "current-password"}
                        placeholder={isSignup ? "At least six characters" : "Enter your password"}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                      />
                      <button
                        className="gc-password-toggle"
                        type="button"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        onClick={() => setShowPassword((current) => !current)}
                      >
                        <Icon name={showPassword ? "eyeOff" : "eye"} />
                      </button>
                    </span>
                  </label>
                )}

                <button className="gc-auth-submit" type="submit" disabled={loading}>
                  {loading
                    ? isReset ? "Sending recovery link..." : isSignup ? "Creating secure account..." : "Authorising access..."
                    : isReset ? "Send recovery link" : isSignup ? "Create account" : "Enter Mission Control"}
                </button>

                <div className="gc-auth-form-footer">
                  {isReset ? (
                    <button className="gc-auth-link" type="button" onClick={() => switchMode("signin")}>Back to sign in</button>
                  ) : mode === "signin" ? (
                    <button className="gc-auth-link" type="button" onClick={() => switchMode("reset")}>Forgot your password?</button>
                  ) : (
                    <span className="gc-auth-link">Email confirmation may be required.</span>
                  )}
                </div>
              </form>
            </>
          )}

          <footer className="gc-auth-panel-footer">
            <span>Engineered by</span>
            <div className="gc-daxora-wordmark">DA<span>X</span>ORA</div>
          </footer>
        </div>
      </section>
    </main>
  );
}
