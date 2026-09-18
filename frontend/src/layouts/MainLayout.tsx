import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  Activity,
  AudioLines,
  ClipboardList,
  LayoutDashboard,
  Plane,
  ScrollText,
  Users,
} from 'lucide-react';

import { getHealth } from '@/services';
import type { HealthInfo } from '@/types';

const NAV_ITEMS: Array<{
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
}> = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/chat', label: 'Agent Chat', icon: AudioLines },
  { to: '/policies', label: 'Policies', icon: ScrollText },
  { to: '/audit', label: 'Audit Trail', icon: ClipboardList },
];

/** Small live pill showing backend reachability. */
function HealthPill() {
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const probe = () =>
      getHealth()
        .then((info) => {
          if (!cancelled) {
            setHealth(info);
            setOffline(false);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setHealth(null);
            setOffline(true);
          }
        });

    probe();
    const interval = window.setInterval(probe, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  if (offline) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs text-red-400">
        <Activity className="h-3 w-3" aria-hidden /> Backend offline
      </span>
    );
  }
  if (!health) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-ops-line bg-ops-850 px-2.5 py-1 text-xs text-ops-muted">
        <Activity className="h-3 w-3" aria-hidden /> Checking…
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-400"
      title={`${health.service} · ${health.environment} · up ${health.uptimeSeconds}s`}
    >
      <Activity className="h-3 w-3" aria-hidden /> API healthy
    </span>
  );
}

export function MainLayout() {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="flex w-56 shrink-0 flex-col border-r border-ops-line bg-ops-900">
        <div className="flex items-center gap-2.5 border-b border-ops-line px-4 py-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-ops-accent/15">
            <Plane className="h-4.5 w-4.5 text-ops-accent" aria-hidden />
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold">Ops Console</div>
            <div className="text-[11px] text-ops-muted">
              Airline Resolution Agent
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-2 py-3">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-ops-accent/15 text-ops-text'
                    : 'text-ops-muted hover:bg-ops-850 hover:text-ops-text'
                }`
              }
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-ops-line px-4 py-3 text-[11px] text-ops-faint">
          Assignment build · v1.0.0
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-ops-line bg-ops-900 px-6 py-3">
          <div className="text-xs text-ops-muted">
            Customer Resolution Operations
          </div>
          <HealthPill />
        </header>

        <main className="min-w-0 flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
