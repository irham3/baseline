import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, BriefcaseBusiness, Gauge, LogOut, Menu, PenLine, UserRound, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const PRIMARY_NAV = [
  { to: "/judge", label: "Demo", Icon: Gauge, testid: "nav-judge" },
  { to: "/analyze", label: "Analyze", Icon: PenLine, testid: "nav-analyze" },
];

function isActive(pathname, target) {
  if (target === "/analyze") return pathname.startsWith("/analyze") || pathname.startsWith("/analysis");
  if (target === "/app") return pathname === "/app";
  return pathname === target;
}

export function Logo({ className = "", dark = false }) {
  return (
    <Link to="/" className={`group inline-flex items-center gap-2.5 ${className}`} data-testid="brand-logo" aria-label="Baseline Work home">
      <img
        src="/assets/baseline-logo-192.png"
        alt="Baseline Work logo"
        className="h-8 w-8 shrink-0 rounded-lg shadow-[0_8px_18px_-12px_rgba(17,99,72,0.7)]"
        width="32"
        height="32"
      />
      <span className={`text-[17px] font-extrabold tracking-tight ${dark ? "text-white" : "text-ink"}`}>
        Baseline <span className={dark ? "text-emerald-400" : "text-green"}>Work</span>
      </span>
    </Link>
  );
}

function NavPill({ item, pathname, layoutId, onClick, dark = false }) {
  const active = isActive(pathname, item.to);
  const Icon = item.Icon;
  return (
    <Link
      to={item.to}
      onClick={onClick}
      className={`relative inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-xs font-semibold transition-colors ${
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
              ? "bg-white/10 border border-white/15 shadow-[0_0_20px_rgba(16,185,129,0.15)]" 
              : "bg-surface shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_10px_24px_-18px_rgba(17,99,72,0.45)]"
          }`}
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
        />
      )}
      <Icon size={14} className="relative" strokeWidth={2} />
      <span className="relative">{item.label}</span>
    </Link>
  );
}

export function Nav({ dark = false }) {
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
        ? "border-white/10 bg-[#090b0e]/85 text-white" 
        : "border-line/80 bg-page/90 text-ink"
    }`}>
      <div className="wrap flex h-[68px] items-center justify-between gap-3">
        <Logo dark={dark} />

        <nav className={`hidden items-center rounded-full border p-1 md:flex ${
          dark 
            ? "border-white/10 bg-white/[0.04]" 
            : "border-line/80 bg-raised/70"
        }`} aria-label="Primary navigation">
          {navItems.map((item) => (
            <NavPill key={item.to} item={item} pathname={location.pathname} layoutId="desktop-nav-active" dark={dark} />
          ))}
        </nav>

        <div className="hidden items-center gap-2.5 md:flex">
          {user ? (
            <>
              <Link to="/app" className={dark ? "btn-sm rounded-full border border-white/15 bg-white/5 px-4 text-xs font-semibold text-white hover:bg-white/10" : "btn-secondary btn-sm max-w-[190px]"} data-testid="nav-account">
                <UserRound size={14} />
                <span className="truncate">{user.name || "Account"}</span>
              </Link>
              <button onClick={signOut} className={dark ? "rounded-full p-2 text-zinc-400 hover:text-white hover:bg-white/5" : "btn-ghost btn-sm px-3"} data-testid="nav-logout" aria-label="Sign out" title="Sign out">
                <LogOut size={15} />
              </button>
            </>
          ) : (
            <Link to="/login" className={dark ? "rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-white/10 hover:text-white transition-colors" : "btn-secondary btn-sm"} data-testid="nav-login">
              Sign in
            </Link>
          )}
          <Link 
            to="/judge" 
            className={dark 
              ? "inline-flex items-center gap-1.5 rounded-full bg-emerald-500 hover:bg-emerald-400 px-4 py-2 text-xs font-bold text-zinc-950 shadow-[0_0_20px_rgba(16,185,129,0.35)] transition-all hover:scale-[1.02]" 
              : "btn-primary btn-sm"
            } 
            data-testid="nav-demo-cta"
          >
            <span>Run demo</span> <ArrowRight size={13} strokeWidth={2.5} />
          </Link>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <Link to="/judge" className={dark ? "rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-bold text-zinc-950" : "btn-primary btn-sm px-3"} data-testid="nav-demo-mobile">
            Demo
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={dark ? "rounded-full border border-white/15 bg-white/5 p-2 text-white" : "btn-secondary btn-sm h-10 w-10 px-0"}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            data-testid="mobile-menu-toggle"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: reduceMotion ? 0 : 0.18 }}
            className="md:hidden"
          >
            <nav className="wrap pb-3" aria-label="Mobile navigation">
              <div className={`grid gap-1 rounded-2xl border p-2 shadow-2xl ${
                dark ? "border-white/15 bg-[#0e1117] text-white" : "border-line bg-surface shadow-lift"
              }`}>
                {navItems.map((item) => (
                  <NavPill key={item.to} item={item} pathname={location.pathname} layoutId="mobile-nav-active" dark={dark} />
                ))}
                {user ? (
                  <button onClick={signOut} className={`btn-sm justify-start px-3.5 ${dark ? "text-zinc-300 hover:text-white" : "btn-ghost"}`} data-testid="nav-logout-mobile">
                    <LogOut size={15} /> Sign out
                  </button>
                ) : (
                  <Link to="/login" className={`btn-sm justify-start px-3.5 ${dark ? "text-zinc-300 hover:text-white" : "btn-ghost"}`} data-testid="nav-login-mobile">
                    <UserRound size={15} /> Sign in
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

export function Footer({ dark = false }) {
  const { user } = useAuth();

  return (
    <footer className={`mt-auto border-t transition-colors ${
      dark 
        ? "border-white/10 bg-[#060709] text-zinc-400" 
        : "mt-20 border-line/80 bg-surface/55 text-ink-soft"
    }`}>
      <div className="wrap grid gap-8 py-12 md:grid-cols-[1.2fr_0.8fr_1fr]">
        <div>
          <Logo dark={dark} />
          <p className={`mt-3 max-w-sm text-sm leading-relaxed ${dark ? "text-zinc-400" : "text-ink-soft"}`}>
            Pre-deal scope checks for freelance short-form video work. Built to price the floor and protect creator margins before production starts.
          </p>
        </div>
        <nav className="grid gap-2.5 text-sm" aria-label="Footer navigation">
          <span className={`text-xs font-bold uppercase tracking-wider ${dark ? "text-zinc-500" : "text-ink-faint"}`}>Navigation</span>
          <Link className={`font-medium transition-colors ${dark ? "text-zinc-300 hover:text-emerald-400" : "text-ink-soft hover:text-ink"}`} to="/judge">Run demo</Link>
          <Link className={`font-medium transition-colors ${dark ? "text-zinc-300 hover:text-emerald-400" : "text-ink-soft hover:text-ink"}`} to="/analyze">Analyze brief</Link>
          <Link className={`font-medium transition-colors ${dark ? "text-zinc-300 hover:text-emerald-400" : "text-ink-soft hover:text-ink"}`} to={user ? "/app" : "/login"}>
            {user ? "Workspace" : "Sign in"}
          </Link>
        </nav>
        <div>
          <span className={`text-xs font-bold uppercase tracking-wider ${dark ? "text-zinc-500" : "text-ink-faint"}`}>Notice</span>
          <p className={`mt-2.5 max-w-md text-xs leading-relaxed ${dark ? "text-zinc-500" : "text-ink-faint"}`}>
            Baseline Work is an estimation and scope-documentation aid. It is not legal advice, a contract substitute, or a profit guarantee.
          </p>
        </div>
      </div>
    </footer>
  );
}

export function Shell({ children, dark = false, className = "" }) {
  return (
    <div className={`flex min-h-screen flex-col ${dark ? "bg-[#090b0e] text-white" : "bg-page text-ink"} ${className}`}>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <Nav dark={dark} />
      <main id="main-content" className="flex-1">{children}</main>
      <Footer dark={dark} />
    </div>
  );
}
