import { Link } from 'react-router-dom';
import { ArrowRight, ScrollText, Users } from 'lucide-react';

import { Badge, Card, CardBody, CardHeader, ErrorState, Loading, LoadingCard } from '@/components';
import { useApi } from '@/hooks';
import { getAuditRecords, getCustomers, getHealth, getPolicies } from '@/services';

/** One quick stat tile. */
function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardBody>
        <div className="text-xs tracking-wide text-ops-muted uppercase">
          {label}
        </div>
        <div className="mt-1 text-2xl font-semibold">{value}</div>
        {hint ? <div className="mt-1 text-xs text-ops-faint">{hint}</div> : null}
      </CardBody>
    </Card>
  );
}

export function DashboardPage() {
  const health = useApi(() => getHealth(), 'health');
  const customers = useApi(() => getCustomers(), 'customers');
  const audit = useApi(() => getAuditRecords(), 'audit');
  const policies = useApi(() => getPolicies(), 'policies');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Operations Dashboard</h1>
        <p className="mt-1 text-sm text-ops-muted">
          Customer-facing resolution agent — live view of the seeded airline
          disruption dataset.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="API status"
          value={health.loading ? '…' : health.data ? 'Online' : 'Offline'}
          hint={
            health.data
              ? `${health.data.environment} · up ${health.data.uptimeSeconds}s`
              : 'backend unreachable'
          }
        />
        <StatCard
          label="Customers"
          value={customers.loading ? '…' : String(customers.data?.length ?? '—')}
          hint="seeded profiles"
        />
        <StatCard
          label="Audit records"
          value={audit.loading ? '…' : String(audit.data?.length ?? '—')}
          hint="agent interactions"
        />
        <StatCard
          label="Policy categories"
          value={policies.loading ? '…' : policies.data ? '7' : '—'}
          hint="cancellation → prohibited"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Quick actions */}
        <Card>
          <CardHeader title="Quick actions" />
          <CardBody className="space-y-2">
            <Link
              to="/chat"
              className="flex items-center justify-between rounded-md border border-ops-line bg-ops-800/50 px-4 py-3 text-sm transition-colors hover:bg-ops-800"
            >
              <span>Open Agent Chat</span>
              <ArrowRight className="h-4 w-4 text-ops-muted" aria-hidden />
            </Link>
            <Link
              to="/customers"
              className="flex items-center justify-between rounded-md border border-ops-line bg-ops-800/50 px-4 py-3 text-sm transition-colors hover:bg-ops-800"
            >
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4 text-ops-muted" aria-hidden />
                Browse customers &amp; bookings
              </span>
              <ArrowRight className="h-4 w-4 text-ops-muted" aria-hidden />
            </Link>
            <Link
              to="/policies"
              className="flex items-center justify-between rounded-md border border-ops-line bg-ops-800/50 px-4 py-3 text-sm transition-colors hover:bg-ops-800"
            >
              <span className="flex items-center gap-2">
                <ScrollText className="h-4 w-4 text-ops-muted" aria-hidden />
                Review service rules
              </span>
              <ArrowRight className="h-4 w-4 text-ops-muted" aria-hidden />
            </Link>
          </CardBody>
        </Card>

        {/* Policy highlights (from the API, not hardcoded rules) */}
        <Card>
          <CardHeader title="Rule highlights" meta="from GET /policies" />
          <CardBody>
            {policies.loading ? (
              <Loading label="Loading policies…" />
            ) : policies.error ? (
              <ErrorState
                message={policies.error.message}
                code={policies.error.code}
                onRetry={policies.reload}
              />
            ) : policies.data ? (
              <ul className="space-y-2 text-sm text-ops-muted">
                <li>
                  <span className="text-ops-text">Refund:</span>{' '}
                  {policies.data.refund.details.type} ·{' '}
                  {policies.data.refund.details.timeframe} ·{' '}
                  {policies.data.refund.details.method}
                </li>
                <li>
                  <span className="text-ops-text">Fare waiver:</span> up to ₹
                  {policies.data.fareDifference.details.maxWaiverWithoutApprovalInr.toLocaleString(
                    'en-IN'
                  )}
                  , above requires supervisor approval
                </li>
                <li>
                  <span className="text-ops-text">Priority rebooking:</span>{' '}
                  {policies.data.loyalty.details.priorityRebookingTiers.join(
                    ' & '
                  )}{' '}
                  tiers
                </li>
                <li>
                  <span className="text-ops-text">Prohibited:</span>{' '}
                  {policies.data.prohibited.details.length} rules the agent can
                  never break
                </li>
              </ul>
            ) : null}
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {[0, 1, 2].map((slot) => {
          const customer = customers.data?.[slot];
          if (customers.loading) return <LoadingCard key={slot} rows={2} />;
          if (!customer) return null;
          return (
            <Card key={customer.pnr}>
              <CardBody className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{customer.name}</div>
                  <div className="text-xs text-ops-muted">
                    PNR {customer.pnr}
                  </div>
                </div>
                <Badge tone={customer.loyaltyTier === 'Platinum' ? 'escalate' : customer.loyaltyTier === 'Gold' ? 'warn' : 'neutral'}>
                  {customer.loyaltyTier}
                </Badge>
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
