import { Badge, Card, CardBody, CardHeader, decisionTone } from '@/components';
import type { ChatData } from '@/types';
import { humanizeIntent } from '@/utils';

/** One executed (or refused) action row. */
function ActionRow({ action }: { action: ChatData['actions'][number] }) {
  const completed = action.status === 'completed';
  return (
    <li className="flex items-start justify-between gap-3 rounded-md border border-ops-line bg-ops-800/50 px-3 py-2 text-sm">
      <div>
        <span className="font-mono text-xs text-ops-accent">
          {action.action}
        </span>
        <div className="text-xs text-ops-muted">{action.reason}</div>
      </div>
      <Badge tone={completed ? 'ok' : 'bad'}>{action.status}</Badge>
    </li>
  );
}

/**
 * Right-hand verdict panels for the latest agent turn:
 * policy decision, executed actions, and any escalation.
 */
export function DecisionPanels({ data }: { data: ChatData }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Policy decision"
          meta={
            <Badge tone={decisionTone(data.decision.status)}>
              {data.decision.status.replace(/_/g, ' ')}
            </Badge>
          }
        />
        <CardBody className="space-y-3 text-sm text-ops-muted">
          <p>{data.decision.explanation}</p>

          {data.decision.eligibleActions.length > 0 ? (
            <div>
              <div className="text-xs tracking-wide text-ops-text uppercase">
                Eligible actions
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {data.decision.eligibleActions.map((actionId) => (
                  <Badge key={actionId} tone="ok">
                    {actionId}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}

          {data.decision.ineligibleActions.length > 0 ? (
            <div>
              <div className="text-xs tracking-wide text-ops-text uppercase">
                Not permitted
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {data.decision.ineligibleActions.map((actionId) => (
                  <Badge key={actionId} tone="bad">
                    {actionId}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}

          <div>
            <div className="text-xs tracking-wide text-ops-text uppercase">
              Policy sources
            </div>
            <ul className="mt-1 space-y-0.5 text-xs">
              {data.policyUsed.map((source) => (
                <li key={source}>· {source}</li>
              ))}
            </ul>
          </div>

          <div className="text-xs text-ops-faint">
            Intent: {humanizeIntent(data.intent)} ·{' '}
            {data.llmUsed ? 'Groq LLM phrasing' : 'deterministic fallback'}
          </div>
        </CardBody>
      </Card>

      {data.actions.length > 0 ? (
        <Card>
          <CardHeader title="Executed actions" meta={`${data.actions.length}`} />
          <CardBody>
            <ul className="space-y-2">
              {data.actions.map((action) => (
                <ActionRow key={action.id} action={action} />
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      {data.escalation ? (
        <Card className="border-purple-500/30">
          <CardHeader
            title="Escalation"
            meta={
              <Badge tone="escalate">{data.escalation.priority} priority</Badge>
            }
          />
          <CardBody className="text-sm text-ops-muted">
            <p>{data.escalation.reason}</p>
            <p className="mt-1 text-xs text-ops-faint">
              Status: {data.escalation.status} · trigger{' '}
              <code className="text-purple-400">{data.escalation.trigger}</code>
            </p>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
