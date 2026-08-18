import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { LogOut, User } from "lucide-react";

export function Logo({ className = "" }) {
  return (
    <Link to="/" className={`group inline-flex items-center gap-2 ${className}`} data-testid="brand-logo">
      <span className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-green text-white">
        <span className="text-[15px] font-extrabold leading-none">B</span>
        <span className="absolute bottom-1 left-1.5 right-1.5 h-[2px] rounded-full bg-white/80" />
      </span>
      <span className="text-[17px] font-extrabold tracking-tight text-ink">Baseline</span>
    </Link>
  );
}

export function Nav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-page/85 backdrop-blur-md">
      <div className="wrap flex h-16 items-center justify-between">
        <Logo />
        <nav className="flex items-center gap-1.5 sm:gap-2">
          <Link to="/judge" className="btn-ghost btn-sm hidden sm:inline-flex" data-testid="nav-judge">
            Judge Mode
          </Link>
          <Link to="/analyze" className="btn-secondary btn-sm" data-testid="nav-analyze">
            Analyze brief
          </Link>
          {user ? (
            <div className="flex items-center gap-1.5">
              <Link to="/app" className="btn-ghost btn-sm inline-flex items-center gap-1.5" data-testid="nav-workspace">
                <User size={15} />
                <span className="hidden sm:inline max-w-[90px] truncate">{user.name || "Akun"}</span>
              </Link>
              <button
                onClick={async () => { await logout(); navigate("/"); }}
                className="btn-ghost btn-sm"
                data-testid="nav-logout"
                aria-label="Keluar"
              >
                <LogOut size={15} />
              </button>
            </div>
          ) : (
            <Link to="/login" className="btn-ghost btn-sm" data-testid="nav-login">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-20 border-t border-line/80">
      <div className="wrap flex flex-col gap-3 py-8 text-sm text-ink-faint sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Logo />
        </div>
        <p className="max-w-md leading-relaxed">
          Baseline is an estimation and scope-documentation aid, not legal advice or a profit
          guarantee. Results depend on the assumptions and data you enter.
        </p>
      </div>
    </footer>
  );
}

export function Shell({ children }) {
  return (
    <div className="flex min-h-screen flex-col bg-page bg-grain">
      <Nav />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
