import React, { useEffect, useRef, useState } from "react";
import { BrowserRouter, Routes, Route, useLocation, useNavigate, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { client } from "@/lib/api";
import { Spinner } from "@/components/ui/primitives";

import Landing from "@/pages/Landing";
import Analysis from "@/pages/Analysis";
import Agreement from "@/pages/Agreement";
import Login from "@/pages/Login";
import Workspace from "@/pages/Workspace";

function AuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const { checkAuth } = useAuth();
  const processed = useRef(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;
    const hash = location.hash || window.location.hash || "";
    const search = location.search || window.location.search || "";
    const hashParams = new URLSearchParams(hash.replace(/^#/, ""));
    const searchParams = new URLSearchParams(search.replace(/^\?/, ""));

    const sessionId = hashParams.get("session_id") || searchParams.get("session_id");
    const credential = hashParams.get("credential") || hashParams.get("id_token") || searchParams.get("credential") || searchParams.get("id_token");
    const accessToken = hashParams.get("access_token") || searchParams.get("access_token");

    if (!sessionId && !credential && !accessToken) {
      navigate("/login", { replace: true });
      return;
    }
    (async () => {
      try {
        if (credential) {
          await client.post("/auth/google", { credential });
        } else if (accessToken) {
          await client.post("/auth/google", { access_token: accessToken });
        } else if (sessionId) {
          await client.post("/auth/google", { session_id: sessionId });
        }
        await checkAuth();
        window.history.replaceState(null, "", "/app");
        navigate("/app", { replace: true });
      } catch (e) {
        setError("Google sign-in failed. Please try again.");
      }
    })();
  }, [location, navigate, checkAuth]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-page">
      {error ? (
        <>
          <p className="text-danger font-semibold" data-testid="oauth-error">{error}</p>
          <button className="btn-secondary btn-md" onClick={() => navigate("/login")}>
            Back to sign in
          </button>
        </>
      ) : (
        <>
          <Spinner size={26} />
          <p className="text-ink-soft">Finishing sign-in...</p>
        </>
      )}
    </div>
  );
}

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center bg-page">
        <Spinner size={26} />
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRouter() {
  const location = useLocation();
  // Detect OAuth callback synchronously during render (prevents race conditions).
  if (
    location.hash?.includes("session_id=") ||
    location.hash?.includes("credential=") ||
    location.hash?.includes("id_token=") ||
    location.hash?.includes("access_token=")
  ) {
    return <AuthCallback />;
  }

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/analysis/:id" element={<Analysis />} />
      <Route path="/s/:token" element={<Agreement />} />
      <Route path="/agreement/:token" element={<Agreement />} />
      <Route path="/login" element={<Login />} />
      <Route path="/app" element={<Protected><Workspace /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </BrowserRouter>
  );
}
