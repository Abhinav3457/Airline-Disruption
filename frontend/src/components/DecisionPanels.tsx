import {
  BadgeCheck,
  Ban,
  CircleDollarSign,
  FileClock,
  Gavel,
  Plane,
  Target,
} from 'lucide-react';

import { Badge, Card, CardBody, CardHeader, decisionTone } from '@/components';
import type { ChatData } from '@/types';
import { formatDate, humanizeIntent } from '@/utils';

/** One executed (or refused) action row — always simulated on the backend. */
function ActionRow({ action }: { action: ChatData['actions'][number] }) {
  const completed = action.status === 'completed';
  return (
    <li className="flex items-start justify-between gap-3 rounded-md border border-ops-line bg-ops-800/50 px-3 py-2 text-sm">
      <div className="min-w-0">
        <span className="font-mono text-xs text-ops-accent">
          {action.action}
        </span>
        <div className="text-xs text-ops-muted">{action.reason}</div>
      </div>
      <Badge tone={completed ? 'ok' : 'bad'}>
        {completed ? 'completed · simulated' : 'refused'}
      </Badge>
    </li>
  );
}

/** The right-hand verdict rail for the latest agent turn. */
export function DecisionPanels({ data }: { data: ChatData }) {
  const { decision, booking } = data;

  return (
    <div className="space-y-4">
      {/* 1. Decision summary + detected intent */}
      <Card>
        <CardHeader
          title="Decision summary"
          meta={
            <Badge tone={decisionTone(decision.status)}>
              {decision.status.replace(/_/g, ' ')}
            </Badge>
          }
        />
        <CardBody className="space-y-3 text-sm text-ops-muted">
          <p className="text-ops-text">{decision.explanation}</p>

          <div className="flex flex-wrap items-center gap-2">
            <Target className="h-3.5 w-3.5 text-ops-muted" aria-hidden />
            <span className="text-xs tracking-wide text-ops-text uppercase">
              Detected intent
            </span>
            <Badge tone="accent">{humanizeIntent(data.intent)}</Badge>
            <span className="text-xs text-ops-faint">
              {data.llmUsed ? '· Groq phrasing' : '· fallback phrasing'}
            </span>
          </div>

          {decision.requiresEscalation && !data.escalation ? (
            <div className="flex items-center gap-2 text-xs text-purple-300/90">
              <Gavel className="h-3.5 w-3.5" aria-hidden />
              {decision.escalationReason ?? 'Supervisor review required.'}
            </div>
          ) : null}
        </CardBody>
      </Card>

      {/* 2. Booking details (from the chat response) */}
      <Card>
        <CardHeader
          title="Booking details"
          meta={booking ? booking.pnr : undefined}
        />
        <CardBody>
          {booking ? (
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center gap-2">
                <Plane className="h-3.5 w-3.5 text-ops-muted" aria-hidden />
                <span className="font-medium">
                  {booking.flight} · {booking.route.from} → {booking.route.to}
                </span>
              </div>
              <div className="text-xs text-ops-muted">
                {formatDate(booking.date)} · scheduled dep{' '}
                {booking.scheduledDeparture}
                {booking.status === 'Delayed'
                  ? ` → updated ${booking.newDeparture}`
                  : ''}
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
          ) : (
            <p className="text-sm text-ops-faint">
              No disrupted booking on this PNR.
            </p>
          )}
        </CardBody>
      </Card>

      {/* 3. Allowed vs rejected — kept visually distinct */}
      <Card>
        <CardHeader title="Policy outcome" />
        <CardBody className="space-y-4 text-sm">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-emerald-400 uppercase">
              <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> Allowed actions
            </div>
            {decision.eligibleActions.length > 0 ? (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {decision.eligibleActions.map((actionId) => (
                  <Badge key={actionId} tone="ok">
                    {actionId}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-xs text-ops-faint">
                Nothing allowed by policy for this request.
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-red-400 uppercase">
              <Ban className="h-3.5 w-3.5" aria-hidden /> Rejected requests
            </div>
            {decision.ineligibleActions.length > 0 ? (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {decision.ineligibleActions.map((actionId) => (
                  <Badge key={actionId} tone="bad">
                    {actionId}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-xs text-ops-faint">Nothing rejected.</p>
            )}
          </div>
        </CardBody>
      </Card>

      {/* 4. Executed / simulated actions */}
      {data.actions.length > 0 ? (
        <Card>
          <CardHeader
            title="Executed actions"
            meta="simulated · backend-executed"
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

      {/* 5. Escalation status — always explicit */}
      <Card className={data.escalation ? 'border-purple-500/30' : undefined}>
        <CardHeader
          title="Escalation status"
          meta={
            data.escalation ? (
              <Badge tone="escalate">{data.escalation.priority} priority</Badge>
            ) : (
              <Badge tone="neutral">none</Badge>
            )
          }
        />
        <CardBody className="text-sm text-ops-muted">
          {data.escalation ? (
            <>
              <p className="flex items-start gap-2">
                <Gavel className="mt-0.5 h-4 w-4 shrink-0 text-purple-400" aria-hidden />
                {data.escalation.reason}
              </p>
              <p className="mt-1.5 text-xs text-ops-faint">
                Routed to a human colleague · trigger{' '}
                <code className="text-purple-400">{data.escalation.trigger}</code>{' '}
                · {data.escalation.status}
              </p>
            </>
          ) : (
            <p>Handled entirely by the agent — no human hand-off needed.</p>
          )}
        </CardBody>
      </Card>

      {/* 6. Policy used + audit ID */}
      <Card>
        <CardHeader title="Policy used" meta={
          <span className="flex items-center gap-1.5">
            <CircleDollarSign className="h-3.5 w-3.5" aria-hidden />
            {data.policyUsed.length} rules
          </span>
        } />
        <CardBody className="space-y-2 text-xs text-ops-muted">
          <ul className="space-y-1">
            {data.policyUsed.map((source) => (
              <li key={source} className="flex items-start gap-1.5">
                <FileClock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                {source}
              </li>
            ))}
          </ul>
          <div className="border-t border-ops-line pt-2">
            <span className="text-ops-text">Audit ID</span>
            <div className="mt-0.5 font-mono text-[11px] break-all text-ops-faint">
              {data.auditId}
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
