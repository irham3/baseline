import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn } from "lucide-react";
import { Shell } from "@/components/Shell";
import { SEO } from "@/components/SEO";
import { Spinner } from "@/components/ui/primitives";
import { useAuth } from "@/context/AuthContext";
import { client, apiErrorMessage } from "@/lib/api";

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || "";

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden className="shrink-0">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.3 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.2C29.2 35 26.7 36 24 36c-5.3 0-9.7-3.1-11.3-7.6l-6.5 5C9.6 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.3 5.2C41.4 35.9 44 30.4 44 24c0-1.3-.1-2.3-.4-3.5z"/>
    </svg>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ email: "", password: "", name: "" });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const googleBtnRef = useRef(null);

  // Handle Google Token Response from GSI
  const handleGoogleCredentialResponse = useCallback(async (response) => {
    if (!response || !response.credential) {
      setError("Google Sign-In was cancelled or did not return a credential.");
      setGoogleLoading(false);
      return;
    }
    setGoogleLoading(true);
    setError(null);
    try {
      const { data } = await client.post("/auth/google", { credential: response.credential });
      setUser(data);
      navigate("/app");
    } catch (err) {
      setError(apiErrorMessage(err.response?.data?.detail) || "Google sign-in failed. Please try again.");
    } finally {
      setGoogleLoading(false);
    }
  }, [navigate, setUser]);

  // Initialize Google Identity Services
  useEffect(() => {
    if (typeof window === "undefined") return;

    const initializeGSI = () => {
      if (window.google?.accounts?.id && GOOGLE_CLIENT_ID) {
        try {
          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleGoogleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true,
          });

          if (googleBtnRef.current) {
            window.google.accounts.id.renderButton(googleBtnRef.current, {
              theme: "outline",
              size: "large",
              type: "standard",
              text: "continue_with",
              shape: "pill",
              width: 380,
            });
          }
        } catch (e) {
          console.warn("Google GSI initialization notice:", e);
        }
      }
    };

    if (window.google?.accounts?.id) {
      initializeGSI();
    } else {
      const timer = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(timer);
          initializeGSI();
        }
      }, 300);
      return () => clearInterval(timer);
    }
  }, [handleGoogleCredentialResponse]);

  const handleGoogleClick = () => {
    setError(null);
    if (!GOOGLE_CLIENT_ID) {
      // If client ID is not configured yet in .env, check for fallback proxy or show guidance notice
      const redirectUrl = window.location.origin + "/app";
      // Check if user has legacy proxy or needs setup
      window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
      return;
    }

    setGoogleLoading(true);
    try {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            // If One Tap is skipped/suppressed, trigger standard sign in
            setGoogleLoading(false);
          }
        });
      } else {
        setGoogleLoading(false);
        setError("Google Identity Services script is loading. Please try again in a moment.");
      }
    } catch (e) {
      setGoogleLoading(false);
      setError("Unable to launch Google Sign-In prompt. Please check your browser settings.");
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const endpoint = mode === "login" ? "/auth/login" : "/auth/register";
      const payload = mode === "login"
        ? { email: form.email, password: form.password }
        : { email: form.email, password: form.password, name: form.name };
      const { data } = await client.post(endpoint, payload);
      setUser(data);
      navigate("/app");
    } catch (e) {
      setError(apiErrorMessage(e.response?.data?.detail) || "Sign-in failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Shell>
      <SEO
        title="Sign In / Register — Baseline Work"
        description="Sign in to your Baseline Work account to save client cost profiles, project calibration records, and historical scope analyses."
        canonical="/login"
      />
      <div className="wrap flex min-h-[70vh] items-center justify-center py-10">
        <div className="w-full max-w-md">
          <h1 className="text-center text-2xl font-extrabold text-ink">Save your workflow</h1>
          <p className="mt-1 text-center text-ink-soft">Sign in to save cost profiles, analyses, and calibration.</p>

          <div className="card mt-6 p-6">
            {/* Google Sign In Button */}
            <div className="relative">
              {GOOGLE_CLIENT_ID && (
                <div ref={googleBtnRef} className="flex justify-center mb-1 overflow-hidden" data-testid="google-rendered-button" />
              )}
              {(!GOOGLE_CLIENT_ID || googleLoading) && (
                <button
                  type="button"
                  onClick={handleGoogleClick}
                  disabled={googleLoading}
                  className="btn-secondary btn-lg w-full flex items-center justify-center gap-2.5 transition-all"
                  data-testid="google-login"
                >
                  {googleLoading ? <Spinner size={18} /> : <GoogleMark />}
                  <span>{googleLoading ? "Signing in with Google..." : "Continue with Google"}</span>
                </button>
              )}
            </div>

            <div className="my-5 flex items-center gap-3 text-xs text-ink-faint">
              <div className="h-px flex-1 bg-line" /> or email <div className="h-px flex-1 bg-line" />
            </div>

            <div className="mb-4 flex rounded-full border border-line bg-raised p-0.5">
              {["login", "register"].map((m) => (
                <button
                  type="button"
                  key={m}
                  onClick={() => { setMode(m); setError(null); }}
                  className={`flex-1 rounded-full py-1.5 text-sm font-semibold transition-colors ${mode === m ? "bg-green text-white" : "text-ink-soft"}`}
                  data-testid={`tab-${m}`}
                >
                  {m === "login" ? "Sign in" : "Create account"}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="space-y-3">
              {mode === "register" && (
                <label className="block">
                  <span className="field-label">Name</span>
                  <input
                    name="name"
                    className="input"
                    autoComplete="name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    data-testid="login-name"
                  />
                </label>
              )}
              <label className="block">
                <span className="field-label">Email</span>
                <input
                  type="email"
                  name="email"
                  required
                  className="input"
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  data-testid="login-email"
                />
              </label>
              <label className="block">
                <span className="field-label">Password</span>
                <input
                  type="password"
                  name="password"
                  required
                  minLength={6}
                  className="input"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  placeholder="Minimum 6 characters"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  data-testid="login-password"
                />
              </label>
              {error && <p className="text-[13px] font-semibold text-danger" data-testid="login-error">{error}</p>}
              <button type="submit" disabled={loading} className="btn-primary btn-lg w-full" data-testid="login-submit">
                {loading ? <Spinner size={18} /> : <><LogIn size={18} /> {mode === "login" ? "Sign in" : "Create account"}</>}
              </button>
            </form>
          </div>
        </div>
      </div>
    </Shell>
  );
}
