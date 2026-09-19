import {
  AlertOctagon,
  Award,
  CheckCircle2,
  Clock,
  Coins,
  PlaneTakeoff,
  RotateCcw,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Zap,
} from 'lucide-react';

import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  ErrorState,
  Loading,
} from '@/components';
import { useApi } from '@/hooks';
import { getPolicies } from '@/services';

export function PoliciesPage() {
  const { data, error, loading, reload } = useApi(() => getPolicies(), 'policies');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-sky-400" />
            <h2 className="text-xl font-extrabold text-white tracking-tight">Service Policy Codex</h2>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Deterministic rules and boundaries enforced by the policy engine. The resolution agent strictly adheres to these rules.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-mono text-sky-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>GET /api/policies</span>
          </span>
        </div>
      </div>

      {loading ? (
        <Loading label="Loading airline policies…" />
      ) : error ? (
        <ErrorState message={error.message} code={error.code} onRetry={reload} />
      ) : data ? (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {/* Cancellation */}
          <Card hoverEffect>
            <CardHeader
              title="Flight Cancellation Entitlements"
              icon={<PlaneTakeoff className="h-4 w-4 text-sky-400" />}
              meta={data.cancellation.source}
            />
            <CardBody className="space-y-3 text-sm">
              <p className="text-xs text-slate-400">
                When an airline cancels a flight, passengers are guaranteed the following remedy options:
              </p>
              <ul className="space-y-2">
                {data.cancellation.details.options.map((option) => (
                  <li
                    key={option}
                    className="flex items-start gap-2.5 rounded-lg border border-slate-800 bg-slate-950/60 p-2.5 text-xs text-slate-200"
                  >
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                    <span>{option}</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          {/* Delay Compensation */}
          <Card hoverEffect>
            <CardHeader
              title="Delay Compensation Tiers"
              icon={<Clock className="h-4 w-4 text-amber-400" />}
              meta={data.delay.source}
            />
            <CardBody className="space-y-3">
              <ul className="space-y-2.5">
                {data.delay.details.tiers.map((tier) => (
                  <li
                    key={tier.condition}
                    className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-sm">
                        {tier.condition}
                      </span>
                      {tier.moreThanHours ? (
                        <Badge tone="warn">{`> ${tier.moreThanHours}h Delay`}</Badge>
                      ) : tier.upToHours ? (
                        <Badge tone="neutral">{`≤ ${tier.upToHours}h Delay`}</Badge>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {tier.entitlements.map((entitlement) => (
                        <span
                          key={entitlement}
                          className="rounded-md bg-slate-800 px-2 py-0.5 text-xs text-slate-300 border border-slate-700/60"
                        >
                          {entitlement}
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          {/* Refund */}
          <Card hoverEffect>
            <CardHeader
              title="Refund Regulations"
              icon={<RotateCcw className="h-4 w-4 text-sky-400" />}
              meta={data.refund.source}
            />
            <CardBody className="space-y-2.5 text-xs text-slate-300">
              <div className="flex items-center justify-between rounded-lg bg-slate-950/60 border border-slate-800 p-2.5">
                <span className="text-slate-400">Refund Type:</span>
                <span className="font-bold text-white">{data.refund.details.type}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-950/60 border border-slate-800 p-2.5">
                <span className="text-slate-400">Processing Timeframe:</span>
                <span className="font-bold text-white">{data.refund.details.timeframe}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-950/60 border border-slate-800 p-2.5">
                <span className="text-slate-400">Remittance Method:</span>
                <span className="font-bold text-emerald-400">{data.refund.details.method}</span>
              </div>
            </CardBody>
          </Card>

          {/* Fare Difference */}
          <Card hoverEffect>
            <CardHeader
              title="Fare Difference &amp; Waivers"
              icon={<Coins className="h-4 w-4 text-amber-400" />}
              meta={data.fareDifference.source}
            />
            <CardBody className="space-y-2.5 text-xs text-slate-300">
              <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-2.5 space-y-1">
                <div className="text-slate-400">General Rule:</div>
                <div className="font-medium text-white">{data.fareDifference.details.rule}</div>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2.5">
                <span className="text-slate-300 font-medium">Autonomous Agent Waiver Limit:</span>
                <span className="font-bold font-mono text-emerald-400 text-sm">
                  ₹{data.fareDifference.details.maxWaiverWithoutApprovalInr.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-2.5 text-slate-400">
                <span className="text-amber-400 font-semibold">Supervisor Gate:</span>{' '}
                {data.fareDifference.details.approvalRule}
              </div>
            </CardBody>
          </Card>

          {/* Loyalty Entitlements */}
          <Card hoverEffect>
            <CardHeader
              title="Loyalty Tier Privileges"
              icon={<Award className="h-4 w-4 text-purple-400" />}
              meta={data.loyalty.source}
            />
            <CardBody className="space-y-2.5 text-xs text-slate-300">
              <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-2.5 space-y-1">
                <div className="text-slate-400">Priority Rebooking Tiers:</div>
                <div className="flex items-center gap-2 pt-1">
                  {data.loyalty.details.priorityRebookingTiers.map((tier) => (
                    <Badge key={tier} tone={tier === 'Platinum' ? 'platinum' : 'gold'}>
                      {tier}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-2.5">
                <div className="text-slate-400">Disruption Compensation:</div>
                <div className="font-medium text-white mt-1">
                  {data.loyalty.details.additionalCompensation}
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Allowed Actions Register */}
          <Card hoverEffect>
            <CardHeader
              title="Allowed Simulated Actions"
              icon={<Zap className="h-4 w-4 text-sky-400" />}
              meta={data.allowedActions.source}
            />
            <CardBody>
              <ul className="space-y-1.5 text-xs">
                {data.allowedActions.details.map((action) => (
                  <li
                    key={action.id}
                    className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/60 p-2 text-slate-300"
                  >
                    <code className="rounded bg-sky-500/10 border border-sky-500/30 px-2 py-0.5 font-mono text-sky-300 text-[11px]">
                      {action.id}
                    </code>
                    <span className="truncate">{action.action}</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          {/* Prohibited Guardrails (Spans full width or highlighted) */}
          <div className="xl:col-span-2">
            <Card glow="rose">
              <CardHeader
                title="Zero-Tolerance Prohibited Rules (Hard Guardrails)"
                icon={<ShieldAlert className="h-4 w-4 text-rose-400" />}
                meta={
                  <Badge tone="bad" pulse size="md">
                    RIGID ENGINE BOUNDARIES
                  </Badge>
                }
              />
              <CardBody className="space-y-3">
                <p className="text-xs text-slate-300">
                  The AI Resolution Copilot and Policy Engine are strictly barred from violating any of the following parameters under all circumstances:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {data.prohibited.details.map((rule) => (
                    <div
                      key={rule}
                      className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200"
                    >
                      <AlertOctagon className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                      <span className="font-medium leading-relaxed">{rule}</span>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}

