import { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';

import { getHealth } from '@/services';
import type { HealthInfo } from '@/types';

/** Small live pill showing backend reachability (probes GET /health every 30 s). */
export function BackendStatus() {
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
      <Activity className="h-3 w-3" aria-hidden /> Backend connected
    </span>
  );
}
