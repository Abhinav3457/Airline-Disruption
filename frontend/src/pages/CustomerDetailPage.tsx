import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, MapPin, Plane } from 'lucide-react';

import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  ErrorState,
  Loading,
  bookingStatusTone,
  loyaltyTone,
} from '@/components';
import { useApi } from '@/hooks';
import { getCustomerByPnr } from '@/services';
import { formatDate } from '@/utils';

export function CustomerDetailPage() {
  const { pnr = '' } = useParams<{ pnr: string }>();
  const { data, error, loading, reload } = useApi(
    () => getCustomerByPnr(pnr),
    pnr || null
  );

  return (
    <div className="space-y-6">
      <Link
        to="/customers"
        className="inline-flex items-center gap-1.5 text-sm text-ops-muted transition-colors hover:text-ops-text"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to customers
      </Link>

      {loading ? (
        <Loading label="Loading profile…" />
      ) : error ? (
        <ErrorState message={error.message} code={error.code} onRetry={reload} />
      ) : data ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Profile column */}
          <Card>
            <CardHeader title="Customer" meta={`GET /api/customers/${pnr}`} />
            <CardBody className="space-y-4">
              <div>
                <div className="text-lg font-semibold">{data.name}</div>
                <div className="mt-1 flex items-center gap-2">
                  <Badge tone={loyaltyTone(data.loyaltyTier)}>
                    {data.loyaltyTier}
                  </Badge>
                  <span className="font-mono text-xs text-ops-muted">
                    PNR {data.pnr}
                  </span>
                </div>
              </div>

              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-ops-muted">Email</dt>
                  <dd className="text-right">{data.email}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ops-muted">Phone</dt>
                  <dd className="text-right">{data.phone}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ops-muted">Flights (12 mo)</dt>
                  <dd>{data.travelHistory.flightsLast12Months}</dd>
                </div>
              </dl>

              <div>
                <div className="text-xs font-medium tracking-wide text-ops-muted uppercase">
                  Previous complaints
                </div>
                {data.previousComplaints.length === 0 ? (
                  <p className="mt-1 text-sm text-ops-faint">None</p>
                ) : (
                  <ul className="mt-1.5 space-y-2">
                    {data.previousComplaints.map((complaint) => (
                      <li
                        key={complaint.issue}
                        className="rounded-md border border-ops-line bg-ops-800/50 px-3 py-2 text-sm"
                      >
                        <div>{complaint.issue}</div>
                        <div className="text-xs text-ops-muted">
                          Resolved: {complaint.resolution}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardBody>
          </Card>

          {/* Bookings column */}
          <div className="space-y-4 lg:col-span-2">
            <Card>
              <CardHeader
                title="Booking legs"
                meta={`${data.bookings.length} legs · GET /api/customers/${pnr}/bookings`}
              />
              <div className="divide-y divide-ops-line">
                {data.bookings.map((booking) => (
                  <div
                    key={`${booking.pnr}-${booking.flight}-${booking.date}`}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-ops-accent/10">
                        <Plane className="h-4 w-4 text-ops-accent" aria-hidden />
                      </span>
                      <div>
                        <div className="text-sm font-medium">
                          {booking.flight} · {booking.route.from} →{' '}
                          {booking.route.to}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-ops-muted">
                          <MapPin className="h-3 w-3" aria-hidden />
                          {formatDate(booking.date)}
                          <span className="text-ops-faint">·</span>
                          <Clock className="h-3 w-3" aria-hidden />
                          dep {booking.scheduledDeparture}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge tone={bookingStatusTone(booking.status)}>
                        {booking.status}
                      </Badge>
                      {booking.status === 'Delayed' ? (
                        <div className="mt-1 text-xs text-ops-muted">
                          {booking.delayHours}h delay · new dep{' '}
                          {booking.newDeparture}
                        </div>
                      ) : null}
                      {booking.status === 'Cancelled' ? (
                        <div className="mt-1 text-xs text-ops-muted">
                          {booking.cancellationReason}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <p className="text-xs text-ops-faint">
              Tip: open{' '}
              <Link
                to={`/agent?pnr=${data.pnr}`}
                className="text-ops-accent hover:underline"
              >
                Customer Agent
              </Link>{' '}
              pre-loaded with PNR {data.pnr} to handle this customer's
              disruption.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
