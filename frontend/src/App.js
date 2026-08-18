import React, { useEffect, useRef, useState } from "react";
import { BrowserRouter, Routes, Route, useLocation, useNavigate, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { client } from "@/lib/api";
import { Spinner } from "@/components/ui/primitives";

import Landing from "@/pages/Landing";
import JudgeMode from "@/pages/JudgeMode";
import Analyze from "@/pages/Analyze";
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
    const hash = location.hash || window.location.hash;
    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const sessionId = params.get("session_id");
    if (!sessionId) {
      navigate("/login", { replace: true });
      return;
    }
    (async () => {
      try {
        await client.post("/auth/google/session", { session_id: sessionId });
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
  if (location.hash?.includes("session_id=")) return <AuthCallback />;

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/judge" element={<JudgeMode />} />
      <Route path="/analyze" element={<Analyze />} />
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
