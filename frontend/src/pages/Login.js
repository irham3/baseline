import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Spinner } from "@/components/ui/primitives";
import { useAuth } from "@/context/AuthContext";
import { client, apiErrorMessage } from "@/lib/api";

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
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

  const googleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/app";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
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
      setError(apiErrorMessage(e.response?.data?.detail) || "Gagal masuk.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Shell>
      <div className="wrap flex min-h-[70vh] items-center justify-center py-10">
        <div className="w-full max-w-md">
          <h1 className="text-center text-2xl font-extrabold tracking-tight text-ink">Save your workflow</h1>
          <p className="mt-1 text-center text-ink-soft">Guest demo & Judge Mode tetap bebas login. Masuk hanya untuk menyimpan cost profile, analisis, dan kalibrasi.</p>

          <div className="card mt-6 p-6">
            <button onClick={googleLogin} className="btn-secondary btn-lg w-full" data-testid="google-login">
              <GoogleMark /> Lanjut dengan Google
            </button>

            <div className="my-5 flex items-center gap-3 text-xs text-ink-faint">
              <div className="h-px flex-1 bg-line" /> atau email <div className="h-px flex-1 bg-line" />
            </div>

            <div className="mb-4 flex rounded-full border border-line bg-raised p-0.5">
              {["login", "register"].map((m) => (
                <button key={m} onClick={() => { setMode(m); setError(null); }} className={`flex-1 rounded-full py-1.5 text-sm font-semibold transition-colors ${mode === m ? "bg-green text-white" : "text-ink-soft"}`} data-testid={`tab-${m}`}>
                  {m === "login" ? "Masuk" : "Daftar"}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="space-y-3">
              {mode === "register" && (
                <input className="input" placeholder="Nama" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="login-name" />
              )}
              <input type="email" required className="input" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="login-email" />
              <input type="password" required minLength={6} className="input" placeholder="Password (min. 6 karakter)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} data-testid="login-password" />
              {error && <p className="text-[13px] font-semibold text-danger" data-testid="login-error">{error}</p>}
              <button type="submit" disabled={loading} className="btn-primary btn-lg w-full" data-testid="login-submit">
                {loading ? <Spinner size={18} /> : <><LogIn size={18} /> {mode === "login" ? "Masuk" : "Buat akun"}</>}
              </button>
            </form>
          </div>
        </div>
      </div>
    </Shell>
  );
}
