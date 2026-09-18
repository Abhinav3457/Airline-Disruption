import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  AudioLines,
  ClipboardList,
  LayoutDashboard,
  Menu,
  Plane,
  ScrollText,
  Ticket,
  Users,
  X,
} from 'lucide-react';

import { BackendStatus } from '@/components';

const NAV_ITEMS: Array<{
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
}> = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/agent', label: 'Customer Agent', icon: AudioLines },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/bookings', label: 'Bookings', icon: Ticket },
  { to: '/policies', label: 'Policies', icon: ScrollText },
  { to: '/audit', label: 'Audit Logs', icon: ClipboardList },
];

/** Sidebar content, shared by the desktop rail and the mobile drawer. */
function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <div className="flex items-center gap-2.5 border-b border-ops-line px-4 py-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-ops-accent/15">
          <Plane className="h-4.5 w-4.5 text-ops-accent" aria-hidden />
        </span>
        <div className="leading-tight">
          <div className="text-sm font-semibold">AeroResolve</div>
          <div className="text-[11px] text-ops-muted">
            Airline Resolution Ops
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
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
    </>
  );
}

/** Human title for the current route, shown in the header. */
function usePageTitle(): string {
  const { pathname } = useLocation();
  if (pathname.startsWith('/agent')) return 'Customer Agent';
  if (pathname.startsWith('/customers')) return 'Customers';
  if (pathname.startsWith('/bookings')) return 'Bookings';
  if (pathname.startsWith('/policies')) return 'Policies';
  if (pathname.startsWith('/audit')) return 'Audit Logs';
  return 'Dashboard';
}

export function MainLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const title = usePageTitle();

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setDrawerOpen(false);
  }, [title]);

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-ops-line bg-ops-900 max-lg:hidden">
        <SidebarNav />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/60"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-60 flex-col border-r border-ops-line bg-ops-900">
            <button
              type="button"
              aria-label="Close navigation"
              className="absolute top-3 right-3 text-ops-muted hover:text-ops-text"
              onClick={() => setDrawerOpen(false)}
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
            <SidebarNav onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      ) : null}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-ops-line bg-ops-900/95 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            {/* Mobile menu button */}
            <button
              type="button"
              aria-label="Open navigation"
              className="rounded-md border border-ops-line p-1.5 text-ops-muted hover:text-ops-text lg:hidden"
              onClick={() => setDrawerOpen(true)}
            >
              <Menu className="h-4 w-4" aria-hidden />
            </button>

            <h1 className="min-w-0 flex-1 truncate text-sm font-semibold sm:text-base">
              {title}
            </h1>

            <div className="flex items-center gap-2 sm:gap-3">
              <BackendStatus />
              {/* Current operator status */}
              <span className="hidden items-center gap-1.5 rounded-full border border-ops-line bg-ops-850 px-2.5 py-1 text-xs text-ops-muted sm:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-ops-ok" aria-hidden />
                Operator · On duty
              </span>
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
