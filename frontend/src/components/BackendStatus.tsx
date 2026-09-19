import { useEffect, useState } from 'react';
import { Radio, WifiOff } from 'lucide-react';

import { getHealth } from '@/services';
import type { HealthInfo } from '@/types';

/** Live airline ops telemetry pill showing backend reachability and engine heartbeat. */
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
    const interval = window.setInterval(probe, 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  if (offline) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-rose-500/40 bg-rose-500/15 px-3 py-1 text-xs font-medium text-rose-300 shadow-[0_0_15px_-3px_rgba(244,63,94,0.3)]">
        <WifiOff className="h-3.5 w-3.5 text-rose-400" aria-hidden />
        <span>Telemetry Offline</span>
      </span>
    );
  }

  if (!health) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/80 px-3 py-1 text-xs font-medium text-slate-400">
        <Radio className="h-3.5 w-3.5 animate-spin text-slate-400" aria-hidden />
        <span>Syncing Ops…</span>
      </span>
    );
  }

  return (
    <span
      className="group relative inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300 shadow-[0_0_16px_-3px_rgba(16,185,129,0.3)] transition-all hover:bg-emerald-500/15"
      title={`${health.service} · ${health.environment} · engine up ${health.uptimeSeconds}s`}
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
      </span>
      <span className="tracking-wide">Policy Engine Online</span>
      <span className="hidden sm:inline-block text-[10px] text-emerald-400/70 font-mono pl-1 border-l border-emerald-500/30">
        LIVE
      </span>
    </span>
  );
}

