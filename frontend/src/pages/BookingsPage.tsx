import { Clock, MapPin, Plane } from 'lucide-react';

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
import { getBookingsByPnr, getCustomers } from '@/services';
import type { Booking, Customer } from '@/types';
import { formatDate } from '@/utils';

/** A booking leg joined with its holder for the table. */
interface BookingRow {
  booking: Booking;
  customer: Customer;
}

export function BookingsPage() {
  // Fetch customers, then every PNR's booking legs — all from the backend.
  const { data, error, loading, reload } = useApi<BookingRow[]>(
    async () => {
      const customers = await getCustomers();
      const joined = await Promise.all(
        customers.map(async (customer): Promise<BookingRow[]> => {
          try {
            const bookings = await getBookingsByPnr(customer.pnr);
            return bookings.map((booking) => ({ booking, customer }));
          } catch {
            // A customer with no bookable legs simply contributes no rows.
            return [];
          }
        })
      );
      return joined.flat();
    },
    'bookings-all'
  );

  const rows = data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Bookings</h2>
        <p className="mt-1 text-sm text-ops-muted">
          Every booking leg across the register, with disruption details where
          they exist. Data is joined live from the backend.
        </p>
      </div>

      {loading ? (
        <Loading label="Loading bookings…" />
      ) : error ? (
        <ErrorState message={error.message} code={error.code} onRetry={reload} />
      ) : (
        <Card>
          <CardHeader
            title={`${rows.length} booking legs`}
            meta="GET /api/customers → GET /api/bookings/:pnr"
          />
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ops-line text-xs tracking-wide text-ops-muted uppercase">
                  <th className="px-4 py-2.5 font-medium">Customer</th>
                  <th className="px-4 py-2.5 font-medium">PNR</th>
                  <th className="px-4 py-2.5 font-medium">Flight</th>
                  <th className="px-4 py-2.5 font-medium">Route</th>
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Scheduled</th>
                  <th className="px-4 py-2.5 font-medium">Updated</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ booking, customer }) => (
                  <tr
                    key={`${booking.pnr}-${booking.flight}-${booking.date}`}
                    className="border-b border-ops-line/60 align-top last:border-0 hover:bg-ops-800/50"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {customer.name}
                        <Badge tone={loyaltyTone(customer.loyaltyTier)}>
                          {customer.loyaltyTier}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {booking.pnr}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Plane className="h-3.5 w-3.5 text-ops-muted" aria-hidden />
                        {booking.flight}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {booking.route.from} → {booking.route.to}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-ops-muted">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3 w-3" aria-hidden />
                        {formatDate(booking.date)}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-ops-muted">
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3" aria-hidden />
                        {booking.scheduledDeparture}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {booking.status === 'Delayed' ? (
                        <span className="text-amber-300/90">
                          {booking.newDeparture}
                        </span>
                      ) : (
                        <span className="text-ops-faint">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={bookingStatusTone(booking.status)}>
                        {booking.status}
                      </Badge>
                      {booking.status === 'Delayed' ? (
                        <div className="mt-1 text-xs text-ops-muted">
                          {booking.delayHours}h delay
                        </div>
                      ) : null}
                      {booking.status === 'Cancelled' ? (
                        <div className="mt-1 text-xs text-ops-muted">
                          {booking.cancellationReason}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length === 0 ? (
            <CardBody>
              <p className="py-6 text-center text-sm text-ops-faint">
                No booking legs returned by the backend.
              </p>
            </CardBody>
          ) : null}
        </Card>
      )}
    </div>
  );
}
