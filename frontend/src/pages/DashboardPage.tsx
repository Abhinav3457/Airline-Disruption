import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Bot,
  CheckCircle2,
  FileCheck2,
  Plane,
  Radio,
  ScrollText,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';

import { Badge, Button, Card, CardBody, CardHeader, ErrorState, Loading, LoadingCard, loyaltyTone } from '@/components';
import { useApi } from '@/hooks';
import { getAuditRecords, getCustomers, getHealth, getPolicies } from '@/services';

/** Elevated KPI Tile with aerospace telemetry styling */
function MetricTile({
  label,
  value,
  hint,
  icon: Icon,
  accent = 'cyan',
}: {
  label: string;
  value: string;
  hint?: string;
  icon: typeof Plane;
  accent?: 'cyan' | 'emerald' | 'purple' | 'amber';
}) {
  const accentStyles = {
    cyan: 'from-sky-500/15 to-blue-500/5 text-sky-400 border-sky-500/20 shadow-sky-500/10',
    emerald: 'from-emerald-500/15 to-teal-500/5 text-emerald-400 border-emerald-500/20 shadow-emerald-500/10',
    purple: 'from-purple-500/15 to-indigo-500/5 text-purple-400 border-purple-500/20 shadow-purple-500/10',
    amber: 'from-amber-500/15 to-orange-500/5 text-amber-400 border-amber-500/20 shadow-amber-500/10',
  }[accent];

  return (
    <Card hoverEffect className="relative">
      <div className="flex items-start justify-between p-4 sm:p-5">
        <div>
          <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
            {label}
          </div>
          <div className="mt-1.5 text-2xl sm:text-3xl font-bold font-mono tracking-tight text-white">
            {value}
          </div>
          {hint ? (
            <div className="mt-1.5 text-xs text-slate-400 flex items-center gap-1.5">
              <span className="h-1 w-1 rounded-full bg-slate-500" />
              <span>{hint}</span>
            </div>
          ) : null}
        </div>
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-gradient-to-br shadow-lg ${accentStyles}`}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </div>
      </div>
    </Card>
  );
}

export function DashboardPage() {
  const health = useApi(() => getHealth(), 'health');
  const customers = useApi(() => getCustomers(), 'customers');
  const audit = useApi(() => getAuditRecords(), 'audit');
  const policies = useApi(() => getPolicies(), 'policies');

  return (
    <div className="space-y-7">
      {/* 1. OCC Hero Control Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-sky-500/30 bg-gradient-to-r from-slate-900 via-slate-900/90 to-sky-950/40 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
        <div className="pointer-events-none absolute -right-16 -bottom-16 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="pointer-events-none absolute left-1/3 top-0 h-40 w-40 rounded-full bg-blue-500/10 blur-2xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-300">
              <Radio className="h-3.5 w-3.5 animate-pulse text-sky-400" />
              <span>Flight Disruption Response Matrix Active</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              AeroResolve Operations Hub
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Real-time airline resolution control center. The deterministic policy engine governs compensation, rebooking, and supervisor escalations with zero hallucinations.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link to="/agent">
              <Button variant="primary" size="lg" className="w-full sm:w-auto">
                <Bot className="h-4 w-4" />
                Launch Resolution Copilot
              </Button>
            </Link>
            <Link to="/bookings">
              <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                <Plane className="h-4 w-4" />
                Flight Status (FIDS)
              </Button>
            </Link>
          </div>
        </div>

        {/* Live Disruption Radar Marquee */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="flex items-center gap-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-rose-300">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
            <div className="truncate">
              <span className="font-bold">SK-204</span> (DEL→BOM): Cancelled (Weather)
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
            <div className="truncate">
              <span className="font-bold">AI-102</span> (BOM→BLR): 4h Technical Delay
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
            <div className="truncate">
              <span className="font-bold">6E-554</span> (DEL→MAA): 6h Crew Delay
            </div>
          </div>
        </div>
      </div>

      {/* 2. KPI Telemetry Tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          label="Engine Status"
          value={health.loading ? '…' : health.data ? 'ONLINE' : 'OFFLINE'}
          hint={
            health.data
              ? `${health.data.environment.toUpperCase()} · Uptime ${health.data.uptimeSeconds}s`
              : 'Backend unreachable'
          }
          icon={Radio}
          accent="emerald"
        />
        <MetricTile
          label="Tracked Passengers"
          value={customers.loading ? '…' : String(customers.data?.length ?? '—')}
          hint="Seeded customer profiles"
          icon={Users}
          accent="cyan"
        />
        <MetricTile
          label="Audit Ledger Logs"
          value={audit.loading ? '…' : String(audit.data?.length ?? '—')}
          hint="Deterministic policy traces"
          icon={FileCheck2}
          accent="purple"
        />
        <MetricTile
          label="Enforced Policies"
          value={
            policies.loading
              ? '…'
              : policies.data
              ? String(Object.keys(policies.data).length)
              : '—'
          }
          hint="Cancellation, Delay, Refunds, Prohibitions"
          icon={ScrollText}
          accent="amber"
        />
      </div>

      {/* 3. High-Priority Disruption Queue */}
      <div>
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-sky-400" />
            <h3 className="text-base font-bold text-white tracking-tight">Active Disruption Triage Queue</h3>
          </div>
          <span className="text-xs text-slate-400">Click a passenger to open AI resolution</span>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {customers.loading ? (
            <>
              <LoadingCard />
              <LoadingCard />
              <LoadingCard />
            </>
          ) : customers.data && customers.data.length > 0 ? (
            customers.data.slice(0, 3).map((customer) => {
              const disruptionDetails: Record<string, { flight: string; route: string; status: 'Cancelled' | 'Delayed'; detail: string }> = {
                ABC123: { flight: 'SK-204', route: 'DEL → BOM', status: 'Cancelled', detail: 'Weather cancellation' },
                DEF456: { flight: 'AI-102', route: 'BOM → BLR', status: 'Delayed', detail: '4h Technical Delay' },
                GHI789: { flight: '6E-554', route: 'DEL → MAA', status: 'Delayed', detail: '6h Crew Delay' },
              };
              const disruptedLeg = disruptionDetails[customer.pnr];
              return (
                <Card key={customer.pnr} hoverEffect className="group">
                  <CardBody className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold text-white text-base group-hover:text-sky-300 transition-colors">
                          {customer.name}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="font-mono text-xs text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                            PNR {customer.pnr}
                          </span>
                          <Badge tone={loyaltyTone(customer.loyaltyTier)}>
                            {customer.loyaltyTier}
                          </Badge>
                        </div>
                      </div>
                      {disruptedLeg ? (
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                          disruptedLeg.status === 'Cancelled' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}>
                          {disruptedLeg.status}
                        </span>
                      ) : null}
                    </div>

                    {disruptedLeg ? (
                      <div className="rounded-lg bg-slate-950/60 border border-slate-800/80 p-3 text-xs space-y-1.5">
                        <div className="flex items-center justify-between text-slate-200">
                          <span className="font-bold text-white">{disruptedLeg.flight}</span>
                          <span>{disruptedLeg.route}</span>
                        </div>
                        <div className="text-slate-400">
                          {disruptedLeg.detail}
                        </div>
                      </div>
                    ) : null}

                    <Link
                      to={`/agent?pnr=${customer.pnr}`}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-800/80 border border-slate-700/80 px-3 py-2 text-xs font-semibold text-slate-200 transition-all hover:bg-sky-500/20 hover:text-white hover:border-sky-500/40"
                    >
                      <span>Resolve in Agent Copilot</span>
                      <ArrowRight className="h-3.5 w-3.5 text-sky-400" />
                    </Link>
                  </CardBody>
                </Card>
              );
            })
          ) : (
            <p className="text-sm text-slate-500">No customer profiles available.</p>
          )}
        </div>
      </div>

      {/* 4. Policy Highlights & Quick Action Hub */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Policy highlights */}
        <Card>
          <CardHeader
            title="Deterministic Rule Constraints"
            icon={<ScrollText className="h-4 w-4" />}
            meta="GET /api/policies"
          />
          <CardBody>
            {policies.loading ? (
              <Loading label="Loading service policies…" />
            ) : policies.error ? (
              <ErrorState
                message={policies.error.message}
                code={policies.error.code}
                onRetry={policies.reload}
              />
            ) : policies.data ? (
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3 rounded-lg border border-slate-800/80 bg-slate-950/40 p-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-white">Full Refund Eligibility:</span>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {policies.data.refund.details.type} within {policies.data.refund.details.timeframe} directly to {policies.data.refund.details.method}.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-lg border border-slate-800/80 bg-slate-950/40 p-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-white">Fare Difference Waiver Threshold:</span>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Instant waiver up to ₹{policies.data.fareDifference.details.maxWaiverWithoutApprovalInr.toLocaleString('en-IN')}; higher amounts require supervisor escalation.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-lg border border-slate-800/80 bg-slate-950/40 p-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-white">Priority Rebooking:</span>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Guaranteed priority for {policies.data.loyalty.details.priorityRebookingTiers.join(' & ')} frequent flyers.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-lg border border-rose-500/20 bg-rose-500/5 p-3">
                  <AlertTriangle className="h-4 w-4 text-rose-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-rose-300">Hard Policy Prohibitions:</span>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {policies.data.prohibited.details.length} rigid rules (no free upgrades on unaffected legs, no unauthorized cash bonuses).
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </CardBody>
        </Card>

        {/* Quick Operations Launchpad */}
        <Card>
          <CardHeader
            title="Operations Launchpad"
            icon={<Sparkles className="h-4 w-4" />}
            meta="Direct Workflows"
          />
          <CardBody className="space-y-3">
            <Link
              to="/agent"
              className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-800/40 p-3.5 transition-all hover:border-sky-500/40 hover:bg-sky-500/10 group"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400 group-hover:scale-105 transition-transform">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">Open AI Customer Copilot</div>
                  <div className="text-xs text-slate-400">Resolve live customer messages with simulated actions</div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-sky-400 group-hover:translate-x-0.5 transition-all" />
            </Link>

            <Link
              to="/bookings"
              className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-800/40 p-3.5 transition-all hover:border-sky-500/40 hover:bg-sky-500/10 group"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 group-hover:scale-105 transition-transform">
                  <Plane className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">Inspect Flight Bookings (FIDS)</div>
                  <div className="text-xs text-slate-400">View flight schedules, delays, and cancellation reasons</div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
            </Link>

            <Link
              to="/audit"
              className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-800/40 p-3.5 transition-all hover:border-purple-500/40 hover:bg-purple-500/10 group"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/20 text-purple-400 group-hover:scale-105 transition-transform">
                  <FileCheck2 className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">View Compliance Audit Ledger</div>
                  <div className="text-xs text-slate-400">Review verified engine verdicts and supervisor escalations</div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-purple-400 group-hover:translate-x-0.5 transition-all" />
            </Link>

            <Link
              to="/policies"
              className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-800/40 p-3.5 transition-all hover:border-emerald-500/40 hover:bg-emerald-500/10 group"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 group-hover:scale-105 transition-transform">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">Inspect Complete Policy Codex</div>
                  <div className="text-xs text-slate-400">Official airline rules governing every resolution</div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
            </Link>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

