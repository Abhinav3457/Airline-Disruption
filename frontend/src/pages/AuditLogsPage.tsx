import { useState } from 'react';
import {
  Clock,
  FileCheck2,
  Filter,
  Fingerprint,
  Gavel,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';

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
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-sky-400" />
            <h2 className="text-xl font-extrabold text-white tracking-tight">Compliance &amp; Interaction Audit Ledger</h2>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Immutable interaction audit trail recording customer claims, policy engine verdicts, executed actions, and supervisor escalations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-mono text-sky-300">
            <Fingerprint className="h-3.5 w-3.5" />
            <span>Audit Proof Verified</span>
          </span>
        </div>
      </div>

      {/* Control Card */}
      <Card className="overflow-hidden border-slate-800 shadow-2xl">
        <CardHeader
          title={activePnr ? `Ledger Records for PNR: ${activePnr}` : 'Comprehensive Audit Ledger'}
          icon={<FileCheck2 className="h-4 w-4 text-sky-400" />}
          meta={data ? `${data.length} interactions logged` : undefined}
        />

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-800/80 p-3 sm:p-4 bg-slate-950/60">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
            <input
              value={filter}
              onChange={(event) => setFilter(event.target.value.toUpperCase())}
              placeholder="Search PNR code (e.g. ABC123)…"
              className="w-full rounded-xl border border-slate-700/80 bg-slate-900 pl-9 pr-3 py-1.5 font-mono text-xs text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none transition-all"
            />
          </div>

          <Button
            size="sm"
            variant="secondary"
            onClick={() => setActivePnr(filter.trim() || null)}
          >
            <Filter className="h-3 w-3" />
            <span>Filter PNR</span>
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
              <X className="h-3 w-3" />
              <span>Clear Filter</span>
            </Button>
          ) : null}

          <span className="ml-auto font-mono text-[11px] text-slate-500 hidden sm:inline-block">
            GET {activePnr ? `/api/audit/${activePnr}` : '/api/audit'}
          </span>
        </div>

        {loading ? (
          <CardBody>
            <Loading label="Querying audit records from secure ledger…" />
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
                <tr className="border-b border-slate-800/80 bg-slate-950/60 text-xs font-bold tracking-wider text-slate-400 uppercase">
                  <th className="px-5 py-3.5 font-semibold">Timestamp</th>
                  <th className="px-5 py-3.5 font-semibold">PNR</th>
                  <th className="px-5 py-3.5 font-semibold">Passenger</th>
                  <th className="px-5 py-3.5 font-semibold">Detected Intent</th>
                  <th className="px-5 py-3.5 font-semibold">Policy Verdict</th>
                  <th className="px-5 py-3.5 font-semibold">Executed Actions</th>
                  <th className="px-5 py-3.5 font-semibold">Escalation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {data.map((record) => (
                  <tr
                    key={record.id}
                    className="hover:bg-slate-800/40 transition-colors align-top"
                  >
                    <td className="px-5 py-4 whitespace-nowrap text-xs text-slate-400 font-mono">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3 text-slate-500" />
                        <span>{formatTimestamp(record.timestamp)}</span>
                      </div>
                    </td>

                    <td className="px-5 py-4 font-mono font-bold text-xs text-sky-400">
                      {record.pnr}
                    </td>

                    <td className="px-5 py-4 font-medium text-white">
                      {record.customer}
                    </td>

                    <td className="px-5 py-4 text-xs text-slate-300">
                      <Badge tone="accent">
                        {humanizeIntent(record.intent)}
                      </Badge>
                    </td>

                    <td className="px-5 py-4 max-w-xs">
                      <Badge tone={decisionToneFromText(record.decision)}>
                        {record.decision.replace(/^\[[\w]+\]\s*/, '').slice(0, 65)}
                        {record.decision.replace(/^\[[\w]+\]\s*/, '').length > 65 ? '…' : ''}
                      </Badge>
                    </td>

                    <td className="px-5 py-4 text-xs text-slate-300">
                      {record.actions.length === 0 ? (
                        <span className="text-slate-500 italic">None</span>
                      ) : (
                        <ul className="space-y-1">
                          {record.actions.map((action) => (
                            <li
                              key={action}
                              className="font-mono text-[11px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded px-1.5 py-0.5"
                            >
                              {action}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>

                    <td className="px-5 py-4">
                      {record.escalation ? (
                        <Badge tone="escalate" pulse>
                          <Gavel className="h-3 w-3 mr-1" />
                          Escalated
                        </Badge>
                      ) : (
                        <span className="text-slate-500 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <CardBody>
            <div className="py-16 text-center text-slate-400 space-y-2">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800/60 text-slate-500">
                <FileCheck2 className="h-6 w-6" />
              </div>
              <p className="font-semibold text-white">No audit records found.</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Interact with the Resolution Copilot in the Customer Agent terminal to generate deterministic audit ledger entries.
              </p>
            </div>
          </CardBody>
        )}
      </Card>
    </div>
  );
}

