import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BriefcaseBusiness, LogOut, Menu, UserRound, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const PRIMARY_NAV = [];

function isActive(pathname, target) {
  if (target === "/app") return pathname === "/app";
  return pathname === target;
}

export function Logo({ className = "", dark = false }) {
  return (
    <Link to="/" className={`group inline-flex items-center gap-2.5 ${className}`} data-testid="brand-logo" aria-label="Baseline Work home">
      <img
        src="/assets/baseline-logo-192.png"
        alt="Baseline Work logo"
        className="h-8 w-8 shrink-0 rounded-lg shadow-[0_8px_18px_-12px_rgba(16,185,129,0.7)]"
        width="32"
        height="32"
      />
      <span className={`text-[16px] font-extrabold tracking-tight ${dark ? "text-white" : "text-ink"}`}>
        Baseline <span className="text-emerald-500">Work</span>
      </span>
    </Link>
  );
}

function NavPill({ item, pathname, layoutId, onClick, dark = true }) {
  const active = isActive(pathname, item.to);
  const Icon = item.Icon;
  return (
    <Link
      to={item.to}
      onClick={onClick}
      className={`relative inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-colors ${
        active 
          ? (dark ? "text-white" : "text-ink") 
          : (dark ? "text-zinc-400 hover:text-white" : "text-ink-soft hover:text-ink")
      }`}
      data-testid={item.testid}
      aria-current={active ? "page" : undefined}
    >
      {active && (
        <motion.span
          layoutId={layoutId}
          className={`absolute inset-0 rounded-full ${
            dark 
              ? "bg-white/10 border border-white/15 shadow-[0_0_15px_rgba(16,185,129,0.15)]" 
              : "bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.06),0_1px_0_rgba(255,255,255,1)_inset]"
          }`}
          transition={{ type: "spring", stiffness: 450, damping: 35 }}
        />
      )}
      <Icon size={13} className="relative" strokeWidth={2.2} />
      <span className="relative">{item.label}</span>
    </Link>
  );
}

export function Nav({ dark = true }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [location.pathname]);

  const navItems = useMemo(() => {
    const items = [...PRIMARY_NAV];
    if (user) items.push({ to: "/app", label: "Workspace", Icon: BriefcaseBusiness, testid: "nav-workspace" });
    return items;
  }, [user]);

  const signOut = async () => {
    await logout();
    navigate("/");
  };

  return (
    <header className={`sticky top-0 z-40 border-b backdrop-blur-xl transition-colors ${
      dark 
        ? "border-white/10 bg-[#090b10]/85 text-white" 
        : "border-line/70 bg-surface/85 text-ink"
    }`}>
      <div className="wrap flex h-[64px] items-center justify-between gap-3">
        <Logo dark={dark} />

        <nav className={`hidden items-center rounded-full border p-1 md:flex ${
          dark 
            ? "border-white/10 bg-white/[0.04]" 
            : "border-line/80 bg-raised/60"
        }`} aria-label="Primary navigation">
          {navItems.map((item) => (
            <NavPill key={item.to} item={item} pathname={location.pathname} layoutId="desktop-nav-active" dark={dark} />
          ))}
        </nav>

        <div className="hidden items-center gap-2.5 md:flex">
          {user ? (
            <>
              <Link to="/app" className={dark ? "rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-white/10 hover:text-white max-w-[180px] truncate" : "btn-secondary btn-sm max-w-[180px]"} data-testid="nav-account">
                <UserRound size={13} className="inline mr-1" />
                <span>{user.name || "Workspace"}</span>
              </Link>
              <button onClick={signOut} className={dark ? "rounded-full p-2 text-zinc-400 hover:text-white hover:bg-white/5 transition-colors" : "btn-ghost btn-sm px-2.5 text-ink-faint hover:text-danger"} data-testid="nav-logout" aria-label="Sign out" title="Sign out">
                <LogOut size={14} />
              </button>
            </>
          ) : (
            <Link to="/login" className={dark ? "rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-white/10 hover:text-white transition-colors" : "btn-ghost btn-sm text-xs font-semibold"} data-testid="nav-login">
              Sign in
            </Link>
          )}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={dark ? "rounded-full border border-white/15 bg-white/5 p-2 text-white" : "btn-secondary btn-sm h-9 w-9 px-0"}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            data-testid="mobile-menu-toggle"
          >
            {open ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: reduceMotion ? 0 : 0.16 }}
            className="md:hidden"
          >
            <nav className="wrap pb-3" aria-label="Mobile navigation">
              <div className={`grid gap-1 rounded-2xl border p-2 shadow-xl ${
                dark ? "border-white/15 bg-[#0e1219] text-white" : "border-line bg-surface"
              }`}>
                {navItems.map((item) => (
                  <NavPill key={item.to} item={item} pathname={location.pathname} layoutId="mobile-nav-active" dark={dark} />
                ))}
                {user ? (
                  <button onClick={signOut} className={`btn-sm justify-start px-3.5 ${dark ? "text-rose-400 hover:bg-rose-500/10" : "text-danger hover:bg-danger-soft/30"}`} data-testid="nav-logout-mobile">
                    <LogOut size={14} /> Sign out
                  </button>
                ) : (
                  <Link to="/login" className={`btn-sm justify-start px-3.5 ${dark ? "text-zinc-300 hover:text-white" : "btn-ghost"}`} data-testid="nav-login-mobile">
                    <UserRound size={14} /> Sign in
                  </Link>
                )}
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

export function Footer({ dark = true }) {
  const { user } = useAuth();

  return (
    <footer className={`mt-auto border-t transition-colors ${
      dark 
        ? "border-white/10 bg-[#06070a] text-zinc-400" 
        : "mt-20 border-line/80 bg-surface/70 text-ink-soft"
    }`}>
      <div className="wrap grid gap-8 py-12 md:grid-cols-[1.3fr_0.8fr_0.9fr]">
        <div>
          <Logo dark={dark} />
          <p className={`mt-3 max-w-sm text-xs leading-relaxed ${dark ? "text-zinc-400" : "text-ink-faint"}`}>
            AI pre-deal baseline check & deterministic price floor calculator for short-form video freelancers. Built for Building Indonesia 2026.
          </p>
          <div className="mt-4 flex items-center gap-2 text-[11px] font-mono text-zinc-500">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
            <span>Deterministic Math Engine • Zero Pricing Hallucinations</span>
          </div>
        </div>
        <nav className="grid gap-2 text-xs" aria-label="Footer navigation">
          <span className={`font-bold uppercase tracking-wider ${dark ? "text-zinc-300" : "text-ink"}`}>Navigation</span>
          <Link className={`font-medium transition-colors ${dark ? "text-zinc-400 hover:text-emerald-400" : "text-ink-soft hover:text-green"}`} to={user ? "/app" : "/login"}>
            {user ? "Freelancer Workspace" : "Sign in / Register"}
          </Link>
        </nav>
        <div>
          <span className={`text-xs font-bold uppercase tracking-wider ${dark ? "text-zinc-300" : "text-ink"}`}>Notice</span>
          <p className={`mt-2 max-w-md text-xs leading-relaxed ${dark ? "text-zinc-500" : "text-ink-faint"}`}>
            Baseline Work is a scope documentation and estimation tool, not legal, tax, or financial advice. Pricing is derived from the cost profile and assumptions you provide, computed by deterministic, versioned formulas — never invented by AI.
          </p>
        </div>
      </div>
    </footer>
  );
}

export function Shell({ children, dark = true, className = "" }) {
  return (
    <div className={`flex min-h-screen flex-col ${dark ? "dark-shell bg-[#090b10] text-white" : "bg-page text-ink"} ${className}`}>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <Nav dark={dark} />
      <main id="main-content" className="flex-1">{children}</main>
      <Footer dark={dark} />
    </div>
  );
}


