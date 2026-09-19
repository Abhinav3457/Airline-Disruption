import { useState } from 'react';
import {
  AlertOctagon,
  Check,
  CheckCircle,
  Copy,
  FileClock,
  Fingerprint,
  Gavel,
  Plane,
  Scale,
  ShieldCheck,
  Target,
  XCircle,
  Zap,
} from 'lucide-react';

import { Badge, Card, CardBody, CardHeader, decisionTone } from '@/components';
import type { ChatData } from '@/types';
import { formatDate, humanizeIntent } from '@/utils';

/** One executed (or refused) action row — simulated on the backend. */
function ActionRow({ action }: { action: ChatData['actions'][number] }) {
  const completed = action.status === 'completed';
  return (
    <li className="flex items-start justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-sm">
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          {completed ? (
            <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
          ) : (
            <XCircle className="h-4 w-4 text-rose-400 shrink-0" />
          )}
          <span className="font-mono text-xs font-semibold text-sky-400">
            {action.action}
          </span>
        </div>
        <div className="text-xs text-slate-400 pl-6">{action.reason}</div>
      </div>
      <Badge tone={completed ? 'ok' : 'bad'}>
        {completed ? 'simulated' : 'refused'}
      </Badge>
    </li>
  );
}

/** The right-hand verdict rail for the latest agent turn. */
export function DecisionPanels({ data }: { data: ChatData }) {
  const { decision, booking } = data;
  const [copiedAudit, setCopiedAudit] = useState(false);

  const copyAuditId = () => {
    navigator.clipboard.writeText(data.auditId);
    setCopiedAudit(true);
    setTimeout(() => setCopiedAudit(false), 2000);
  };

  const statusGlowMap: Record<string, 'emerald' | 'amber' | 'rose' | 'purple' | 'cyan'> = {
    eligible: 'emerald',
    partially_eligible: 'amber',
    ineligible: 'rose',
    escalation_required: 'purple',
    clarification_required: 'cyan',
  };

  const glowType = statusGlowMap[decision.status] || 'cyan';

  return (
    <div className="space-y-4">
      {/* 1. Master Verdict Summary */}
      <Card glow={glowType}>
        <CardHeader
          title="Policy Engine Verdict"
          icon={<Scale className="h-4 w-4 text-sky-400" />}
          meta={
            <Badge tone={decisionTone(decision.status)} pulse size="md">
              {decision.status.replace(/_/g, ' ').toUpperCase()}
            </Badge>
          }
        />
        <CardBody className="space-y-3.5 text-sm">
          <p className="text-slate-100 font-medium leading-relaxed">
            {decision.explanation}
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Target className="h-3.5 w-3.5 text-sky-400" aria-hidden />
              <span>Intent:</span>
            </div>
            <Badge tone="accent">{humanizeIntent(data.intent)}</Badge>
            <span className="text-[11px] text-slate-500 font-mono">
              {data.llmUsed ? 'Groq Llama-3 Phrased' : 'Deterministic Phrased'}
            </span>
          </div>

          {decision.requiresEscalation && !data.escalation ? (
            <div className="flex items-center gap-2 rounded-lg bg-purple-500/10 border border-purple-500/30 p-2.5 text-xs text-purple-300">
              <Gavel className="h-4 w-4 shrink-0 text-purple-400" aria-hidden />
              <span>{decision.escalationReason ?? 'Supervisor review mandatory.'}</span>
            </div>
          ) : null}
        </CardBody>
      </Card>

      {/* 2. Disrupted Booking Anchor */}
      {booking ? (
        <Card>
          <CardHeader
            title="Referenced Booking"
            icon={<Plane className="h-4 w-4 text-sky-400" />}
            meta={<span className="font-mono text-sky-400 font-bold">PNR {booking.pnr}</span>}
          />
          <CardBody className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-bold text-white font-mono text-sm">
                {booking.flight} · {booking.route.from} → {booking.route.to}
              </div>
              <Badge
                tone={
                  booking.status === 'Cancelled'
                    ? 'bad'
                    : booking.status === 'Delayed'
                    ? 'warn'
                    : 'ok'
                }
              >
                {booking.status}
              </Badge>
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-2">
              <span>{formatDate(booking.date)}</span>
              <span>·</span>
              <span>Sched: {booking.scheduledDeparture}</span>
              {booking.status === 'Delayed' ? (
                <span className="text-amber-300 font-semibold">
                  ➔ New: {booking.newDeparture} (+{booking.delayHours}h)
                </span>
              ) : null}
            </div>
          </CardBody>
        </Card>
      ) : null}

      {/* 3. Allowed vs Ineligible Policy Outcomes */}
      <Card>
        <CardHeader
          title="Entitlement Breakdown"
          icon={<ShieldCheck className="h-4 w-4 text-emerald-400" />}
        />
        <CardBody className="space-y-4 text-sm">
          {/* Allowed */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-emerald-400 uppercase">
              <CheckCircle className="h-3.5 w-3.5" aria-hidden />
              <span>Allowed by Airline Policy</span>
            </div>
            {decision.eligibleActions.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {decision.eligibleActions.map((actionId) => (
                  <span
                    key={actionId}
                    className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-mono font-medium text-emerald-300"
                  >
                    <Check className="h-3 w-3 text-emerald-400" />
                    {actionId}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic pl-5">
                No compensation or actions allowed under current rules.
              </p>
            )}
          </div>

          {/* Ineligible */}
          <div className="space-y-2 pt-3 border-t border-slate-800/80">
            <div className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-rose-400 uppercase">
              <AlertOctagon className="h-3.5 w-3.5" aria-hidden />
              <span>Rejected / Ineligible Demands</span>
            </div>
            {decision.ineligibleActions.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {decision.ineligibleActions.map((actionId) => (
                  <span
                    key={actionId}
                    className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs font-mono font-medium text-rose-300"
                  >
                    <XCircle className="h-3 w-3 text-rose-400" />
                    {actionId}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic pl-5">
                Zero invalid or prohibited demands identified.
              </p>
            )}
          </div>
        </CardBody>
      </Card>

      {/* 4. Executed Actions Simulator */}
      {data.actions.length > 0 ? (
        <Card>
          <CardHeader
            title="Executed Actions"
            icon={<Zap className="h-4 w-4 text-sky-400" />}
            meta="simulated backend dispatch"
          />
          <CardBody>
            <ul className="space-y-2">
              {data.actions.map((action) => (
                <ActionRow key={action.id} action={action} />
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      {/* 5. Escalation Dispatch Status */}
      <Card glow={data.escalation ? 'purple' : 'none'}>
        <CardHeader
          title="Supervisor Escalation"
          icon={<Gavel className="h-4 w-4 text-purple-400" />}
          meta={
            data.escalation ? (
              <Badge tone="escalate" pulse>
                {data.escalation.priority.toUpperCase()} PRIORITY
              </Badge>
            ) : (
              <Badge tone="neutral">RESOLVED BY AGENT</Badge>
            )
          }
        />
        <CardBody className="text-sm">
          {data.escalation ? (
            <div className="space-y-2.5">
              <div className="flex items-start gap-2.5 text-purple-200">
                <Gavel className="h-4 w-4 shrink-0 text-purple-400 mt-0.5" />
                <span className="font-medium">{data.escalation.reason}</span>
              </div>
              <div className="rounded-lg bg-slate-950/60 border border-purple-500/20 p-2.5 text-xs text-slate-400 space-y-1">
                <div>
                  <span className="text-slate-500">Trigger Rule:</span>{' '}
                  <code className="text-purple-300 font-mono font-bold">
                    {data.escalation.trigger}
                  </code>
                </div>
                <div>
                  <span className="text-slate-500">Routing Status:</span>{' '}
                  <span className="text-emerald-400 font-medium capitalize">
                    {data.escalation.status}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400">
              Handled completely by autonomous policy evaluation. No human intervention required.
            </p>
          )}
        </CardBody>
      </Card>

      {/* 6. Policy Codex Trace & Cryptographic Audit ID */}
      <Card>
        <CardHeader
          title="Verification & Audit Trace"
          icon={<Fingerprint className="h-4 w-4 text-slate-400" />}
        />
        <CardBody className="space-y-3 text-xs text-slate-400">
          <div>
            <span className="font-bold text-slate-300 uppercase tracking-wider text-[10px]">
              Rules Consulted ({data.policyUsed.length})
            </span>
            <ul className="mt-1.5 space-y-1">
              {data.policyUsed.map((source) => (
                <li key={source} className="flex items-center gap-1.5 text-slate-300">
                  <FileClock className="h-3 w-3 text-sky-400" />
                  <span>{source}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between text-slate-300">
              <span className="font-bold text-[10px] uppercase tracking-wider">
                Cryptographic Audit ID
              </span>
              <button
                type="button"
                onClick={copyAuditId}
                className="flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 cursor-pointer transition-colors"
              >
                {copiedAudit ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span>Copy ID</span>
                  </>
                )}
              </button>
            </div>
            <div className="mt-1 font-mono text-[11px] text-slate-500 bg-slate-950/70 border border-slate-800/70 rounded px-2 py-1 select-all break-all">
              {data.auditId}
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

