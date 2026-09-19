import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  AudioLines,
  Clock,
  LayoutDashboard,
  Menu,
  Plane,
  ScrollText,
  ShieldCheck,
  Ticket,
  UserCheck,
  Users,
  X,
} from 'lucide-react';

import { BackendStatus } from '@/components';

const NAV_ITEMS: Array<{
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: string;
  badgeTone?: 'cyan' | 'purple' | 'amber';
  end?: boolean;
}> = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/agent', label: 'Resolution Agent', icon: AudioLines, badge: 'AI Copilot', badgeTone: 'cyan' },
  { to: '/bookings', label: 'Flight Bookings', icon: Ticket, badge: 'Disruptions', badgeTone: 'amber' },
  { to: '/customers', label: 'Passenger Register', icon: Users },
  { to: '/policies', label: 'Service Rules', icon: ScrollText },
  { to: '/audit', label: 'Compliance Audit', icon: ShieldCheck, badge: 'Ledger', badgeTone: 'purple' },
];

/** Live UTC and Flight Ops digital clock. */
function FlightOpsClock() {
  const [time, setTime] = useState({ utc: '', local: '' });

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime({
        utc: `${now.toUTCString().slice(17, 25)} UTC`,
        local: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      });
    };
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="hidden xl:flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-xs">
      <div className="flex items-center gap-1.5 text-sky-400 font-mono font-medium">
        <Clock className="h-3.5 w-3.5" aria-hidden />
        <span>{time.utc || '00:00:00 UTC'}</span>
      </div>
      <span className="text-slate-600">|</span>
      <div className="text-slate-400 font-mono">
        <span className="text-slate-500 text-[10px] mr-1">LOC</span>
        {time.local || '00:00:00'}
      </div>
    </div>
  );
}

/** Sidebar content with radar brand emblem and interactive nav pills. */
function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col justify-between">
      <div>
        {/* Brand Header */}
        <div className="flex items-center gap-3 border-b border-slate-800/80 px-5 py-4 bg-slate-900/40">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 shadow-[0_0_20px_-3px_rgba(56,189,248,0.4)]">
            <Plane className="h-5 w-5 text-white transform -rotate-45" aria-hidden />
            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-400" />
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-base font-bold tracking-tight text-white font-mono">AeroResolve</span>
            </div>
            <div className="text-[11px] font-medium tracking-wide text-sky-400/90 uppercase">
              OCC Resolution Engine
            </div>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="space-y-1.5 px-3 py-4">
          <div className="px-3 pb-2 text-[10px] font-bold tracking-wider text-slate-500 uppercase">
            Operations Console
          </div>
          {NAV_ITEMS.map(({ to, label, icon: Icon, badge, badgeTone, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onNavigate}
              className={({ isActive }) =>
                `group relative flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-sky-500/20 via-blue-500/15 to-transparent text-white border-l-2 border-sky-400 shadow-sm'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon
                      className={`h-4.5 w-4.5 transition-colors ${
                        isActive ? 'text-sky-400' : 'text-slate-400 group-hover:text-slate-200'
                      }`}
                      aria-hidden
                    />
                    <span className="truncate">{label}</span>
                  </div>
                  {badge ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${
                        badgeTone === 'amber'
                          ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                          : badgeTone === 'purple'
                          ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                          : 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                      }`}
                    >
                      {badge}
                    </span>
                  ) : null}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Footer system stamp */}
      <div className="border-t border-slate-800/80 p-4 bg-slate-950/40">
        <div className="flex items-center gap-2.5 rounded-lg border border-slate-800/60 bg-slate-900/50 p-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-800 text-sky-400">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-slate-300 truncate">Deterministic Policy</div>
            <div className="text-[10px] text-slate-500 font-mono">Rules v1.0.0 · Sandboxed LLM</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Human title for the current route, shown in the header. */
function usePageTitle(): { title: string; subtitle: string } {
  const { pathname } = useLocation();
  if (pathname.startsWith('/agent')) {
    return { title: 'AI Customer Resolution Copilot', subtitle: 'Automated passenger entitlement & action simulator' };
  }
  if (pathname.startsWith('/customers')) {
    return { title: 'Passenger Directory & Profiles', subtitle: 'Frequent flyer tiers & historical records' };
  }
  if (pathname.startsWith('/bookings')) {
    return { title: 'Flight Information Display (FIDS)', subtitle: 'Real-time schedules, delays & cancellation status' };
  }
  if (pathname.startsWith('/policies')) {
    return { title: 'Service Policy & Enforcement Rules', subtitle: 'Rigid compensation, refund & prohibited guidelines' };
  }
  if (pathname.startsWith('/audit')) {
    return { title: 'Compliance & Audit Ledger', subtitle: 'Cryptographic interaction audit logs & decision traces' };
  }
  return { title: 'Operations Control Center (OCC)', subtitle: 'Live flight disruption monitoring & automated resolution' };
}

export function MainLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { title, subtitle } = usePageTitle();

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setDrawerOpen(false);
  }, [title]);

  return (
    <div className="flex min-h-screen bg-[#070a0f] text-slate-100">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 z-30 flex h-screen w-64 shrink-0 flex-col border-r border-slate-800/80 bg-slate-900/70 backdrop-blur-2xl max-lg:hidden">
        <SidebarNav />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-slate-800 bg-slate-900 shadow-2xl">
            <button
              type="button"
              aria-label="Close navigation"
              className="absolute top-4 right-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              onClick={() => setDrawerOpen(false)}
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
            <SidebarNav onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      ) : null}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
            {/* Left: Mobile button + Title & Subtitle */}
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                aria-label="Open navigation"
                className="rounded-lg border border-slate-800 p-2 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
                onClick={() => setDrawerOpen(true)}
              >
                <Menu className="h-5 w-5" aria-hidden />
              </button>

              <div className="min-w-0">
                <h1 className="text-base font-bold tracking-tight text-white sm:text-lg truncate">
                  {title}
                </h1>
                <p className="hidden md:block text-xs text-slate-400 truncate">
                  {subtitle}
                </p>
              </div>
            </div>

            {/* Right: Clock + Telemetry + Operator */}
            <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
              <FlightOpsClock />
              <BackendStatus />

              {/* Operator Badge */}
              <div className="hidden sm:flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/60 px-3 py-1 text-xs">
                <div className="relative flex h-5 w-5 items-center justify-center rounded-full bg-sky-500/20 text-sky-400">
                  <UserCheck className="h-3 w-3" />
                </div>
                <span className="text-slate-300 font-medium">Duty Officer</span>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden />
              </div>
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

