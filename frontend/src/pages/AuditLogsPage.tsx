import { useState } from 'react';

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ErrorState,
  Loading,
  decisionTone,
} from '@/components';
import { useApi } from '@/hooks';
import { getAuditByPnr, getAuditRecords } from '@/services';
import { formatTimestamp, humanizeIntent } from '@/utils';

/** Extract 'status' from a decision string like '[eligible] …'. */
function decisionToneFromText(decision: string) {
  const status = decision.match(/^\[(\w+)\]/)?.[1];
  if (
    status === 'eligible' ||
    status === 'partially_eligible' ||
    status === 'ineligible' ||
    status === 'escalation_required' ||
    status === 'clarification_required'
  ) {
    return decisionTone(status);
  }
  return 'neutral' as const;
}

export function AuditLogsPage() {
  const [filter, setFilter] = useState('');
  const [activePnr, setActivePnr] = useState<string | null>(null);

  const { data, error, loading, reload } = useApi(
    () => (activePnr ? getAuditByPnr(activePnr) : getAuditRecords()),
    activePnr === null ? 'audit-all' : `audit-${activePnr}`
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Audit Logs</h2>
        <p className="mt-1 text-sm text-ops-muted">
          Every agent interaction: what was asked, which policies applied, the
          decision, executed actions, and escalations.
        </p>
      </div>

      <Card>
        <CardHeader
          title={activePnr ? `Records for ${activePnr}` : 'All records'}
          meta={data ? `${data.length} records` : undefined}
        />
        <CardBody className="flex flex-wrap items-center gap-2 border-b border-ops-line">
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value.toUpperCase())}
            placeholder="Filter by PNR…"
            className="w-40 rounded-md border border-ops-line bg-ops-800 px-2.5 py-1.5 font-mono text-sm placeholder:text-ops-faint focus:border-ops-accent focus:outline-none"
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setActivePnr(filter.trim() || null)}
          >
            Apply
          </Button>
          {activePnr ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setFilter('');
                setActivePnr(null);
              }}
            >
              Clear
            </Button>
          ) : null}
          <span className="ml-auto text-xs text-ops-faint">
            GET {activePnr ? `/api/audit/${activePnr}` : '/api/audit'}
          </span>
        </CardBody>

        {loading ? (
          <CardBody>
            <Loading label="Loading audit records…" />
          </CardBody>
        ) : error ? (
          <CardBody>
            <ErrorState
              message={error.message}
              code={error.code}
              onRetry={reload}
            />
          </CardBody>
        ) : data && data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ops-line text-xs tracking-wide text-ops-muted uppercase">
                  <th className="px-4 py-2.5 font-medium">Time</th>
                  <th className="px-4 py-2.5 font-medium">PNR</th>
                  <th className="px-4 py-2.5 font-medium">Customer</th>
                  <th className="px-4 py-2.5 font-medium">Intent</th>
                  <th className="px-4 py-2.5 font-medium">Decision</th>
                  <th className="px-4 py-2.5 font-medium">Actions</th>
                  <th className="px-4 py-2.5 font-medium">Escalation</th>
                </tr>
              </thead>
              <tbody>
                {data.map((record) => (
                  <tr
                    key={record.id}
                    className="border-b border-ops-line/60 align-top last:border-0 hover:bg-ops-800/50"
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-ops-muted">
                      {formatTimestamp(record.timestamp)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {record.pnr}
                    </td>
                    <td className="px-4 py-3">{record.customer}</td>
                    <td className="px-4 py-3 text-ops-muted">
                      {humanizeIntent(record.intent)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={decisionToneFromText(record.decision)}>
                        {record.decision.replace(/^\[[\w]+\]\s*/, '').slice(0, 60)}
                        {record.decision.replace(/^\[[\w]+\]\s*/, '').length > 60
                          ? '…'
                          : ''}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-ops-muted">
                      {record.actions.length === 0 ? (
                        <span className="text-ops-faint">—</span>
                      ) : (
                        <ul className="space-y-0.5">
                          {record.actions.map((action) => (
                            <li key={action}>{action}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {record.escalation ? (
                        <Badge tone="escalate">Escalated</Badge>
                      ) : (
                        <span className="text-ops-faint">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <CardBody>
            <p className="py-6 text-center text-sm text-ops-faint">
              No audit records yet — send a message in Agent Chat to create one.
            </p>
          </CardBody>
        )}
      </Card>
    </div>
  );
}
