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

/** Renders one policy envelope as a titled section. */
function PolicySection({
  title,
  source,
  children,
}: {
  title: string;
  source: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader title={title} meta={source} />
      <CardBody className="text-sm text-ops-muted">{children}</CardBody>
    </Card>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="list-inside list-disc space-y-1">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function PoliciesPage() {
  const { data, error, loading, reload } = useApi(() => getPolicies(), 'policies');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Service Rules</h1>
        <p className="mt-1 text-sm text-ops-muted">
          The exact policy documents the deterministic engine enforces — served
          by GET /api/policies. The agent cannot deviate from these.
        </p>
      </div>

      {loading ? (
        <Loading label="Loading policies…" />
      ) : error ? (
        <ErrorState message={error.message} code={error.code} onRetry={reload} />
      ) : data ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <PolicySection
            title="Cancellation"
            source={data.cancellation.source}
          >
            <List items={data.cancellation.details.options} />
          </PolicySection>

          <PolicySection title="Delay compensation" source={data.delay.source}>
            <ul className="space-y-2.5">
              {data.delay.details.tiers.map((tier) => (
                <li
                  key={tier.condition}
                  className="rounded-md border border-ops-line bg-ops-800/50 px-3 py-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-ops-text">
                      {tier.condition}
                    </span>
                    {tier.moreThanHours ? (
                      <Badge tone="warn">{`> ${tier.moreThanHours}h`}</Badge>
                    ) : tier.upToHours ? (
                      <Badge tone="neutral">{`≤ ${tier.upToHours}h`}</Badge>
                    ) : null}
                  </div>
                  <div className="mt-1">{tier.entitlements.join(' · ')}</div>
                </li>
              ))}
            </ul>
          </PolicySection>

          <PolicySection title="Refund" source={data.refund.source}>
            <ul className="space-y-1">
              <li>
                <span className="text-ops-text">Type:</span>{' '}
                {data.refund.details.type}
              </li>
              <li>
                <span className="text-ops-text">Timeframe:</span>{' '}
                {data.refund.details.timeframe}
              </li>
              <li>
                <span className="text-ops-text">Method:</span>{' '}
                {data.refund.details.method}
              </li>
            </ul>
          </PolicySection>

          <PolicySection
            title="Fare difference"
            source={data.fareDifference.source}
          >
            <ul className="space-y-1">
              <li>{data.fareDifference.details.rule}</li>
              <li>
                <span className="text-ops-text">
                  Waiver without approval up to:
                </span>{' '}
                ₹
                {data.fareDifference.details.maxWaiverWithoutApprovalInr.toLocaleString(
                  'en-IN'
                )}
              </li>
              <li>{data.fareDifference.details.approvalRule}</li>
            </ul>
          </PolicySection>

          <PolicySection title="Loyalty" source={data.loyalty.source}>
            <ul className="space-y-1">
              <li>
                <span className="text-ops-text">Priority rebooking:</span>{' '}
                {data.loyalty.details.priorityRebookingTiers.join(' & ')}
              </li>
              <li>{data.loyalty.details.additionalCompensation}</li>
            </ul>
          </PolicySection>

          <PolicySection
            title="Allowed actions"
            source={data.allowedActions.source}
          >
            <ul className="space-y-1.5">
              {data.allowedActions.details.map((action) => (
                <li key={action.id}>
                  <code className="mr-2 rounded bg-ops-800 px-1.5 py-0.5 text-xs text-ops-accent">
                    {action.id}
                  </code>
                  {action.action}
                </li>
              ))}
            </ul>
          </PolicySection>

          <PolicySection
            title="Prohibited"
            source={data.prohibited.source}
          >
            <ul className="list-inside list-disc space-y-1 text-red-300/90">
              {data.prohibited.details.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </PolicySection>
        </div>
      ) : null}
    </div>
  );
}
