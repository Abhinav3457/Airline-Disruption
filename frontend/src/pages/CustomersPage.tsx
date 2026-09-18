import { Link } from 'react-router-dom';

import { Badge, Card, CardHeader, ErrorState, Loading, loyaltyTone } from '@/components';
import { useApi } from '@/hooks';
import { getCustomers } from '@/services';

export function CustomersPage() {
  const { data, error, loading, reload } = useApi(() => getCustomers(), 'customers');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Customers</h1>
        <p className="mt-1 text-sm text-ops-muted">
          Seeded customer register — click a row for the full profile and
          booking legs.
        </p>
      </div>

      {loading ? (
        <Loading label="Loading customers…" />
      ) : error ? (
        <ErrorState message={error.message} code={error.code} onRetry={reload} />
      ) : data ? (
        <Card>
          <CardHeader title={`${data.length} customers`} meta="GET /api/customers" />
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ops-line text-xs tracking-wide text-ops-muted uppercase">
                  <th className="px-4 py-2.5 font-medium">Customer</th>
                  <th className="px-4 py-2.5 font-medium">PNR</th>
                  <th className="px-4 py-2.5 font-medium">Tier</th>
                  <th className="px-4 py-2.5 font-medium">Contact</th>
                  <th className="px-4 py-2.5 font-medium">Flights (12 mo)</th>
                  <th className="px-4 py-2.5 font-medium">Prior complaints</th>
                </tr>
              </thead>
              <tbody>
                {data.map((customer) => (
                  <tr
                    key={customer.pnr}
                    className="border-b border-ops-line/60 last:border-0 hover:bg-ops-800/50"
                  >
                    <td className="px-4 py-3">
                      <Link
                        to={`/customers/${customer.pnr}`}
                        className="font-medium text-ops-accent hover:underline"
                      >
                        {customer.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{customer.pnr}</td>
                    <td className="px-4 py-3">
                      <Badge tone={loyaltyTone(customer.loyaltyTier)}>
                        {customer.loyaltyTier}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-ops-muted">
                      <div>{customer.email}</div>
                      <div className="text-xs">{customer.phone}</div>
                    </td>
                    <td className="px-4 py-3">
                      {customer.travelHistory.flightsLast12Months}
                    </td>
                    <td className="max-w-[240px] truncate px-4 py-3" title={
                      customer.previousComplaints
                        .map((complaint) => complaint.issue)
                        .join(', ')
                    }>
                      {customer.previousComplaints.length === 0 ? (
                        <span className="text-ops-faint">None</span>
                      ) : (
                        customer.previousComplaints
                          .map((complaint) => complaint.issue)
                          .join(', ')
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
