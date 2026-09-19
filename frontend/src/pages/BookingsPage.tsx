import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  Filter,
  Plane,
  Search,
  Sparkles,
  Ticket,
} from 'lucide-react';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DISRUPTED' | 'DELAYED' | 'CANCELLED' | 'UNAFFECTED'>('ALL');

  // Fetch customers, then every PNR's booking legs.
  const { data, error, loading, reload } = useApi<BookingRow[]>(
    async () => {
      const customers = await getCustomers();
      const joined = await Promise.all(
        customers.map(async (customer): Promise<BookingRow[]> => {
          try {
            const bookings = await getBookingsByPnr(customer.pnr);
            return bookings.map((booking) => ({ booking, customer }));
          } catch {
            return [];
          }
        })
      );
      return joined.flat();
    },
    'bookings-all'
  );

  const rows = data ?? [];

  // Filter rows by search and status
  const filteredRows = useMemo(() => {
    return rows.filter(({ booking, customer }) => {
      // Status Filter
      if (statusFilter === 'DISRUPTED' && booking.status === 'Unaffected') return false;
      if (statusFilter === 'DELAYED' && booking.status !== 'Delayed') return false;
      if (statusFilter === 'CANCELLED' && booking.status !== 'Cancelled') return false;
      if (statusFilter === 'UNAFFECTED' && booking.status !== 'Unaffected') return false;

      // Text Search
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        booking.pnr.toLowerCase().includes(term) ||
        booking.flight.toLowerCase().includes(term) ||
        booking.route.from.toLowerCase().includes(term) ||
        booking.route.to.toLowerCase().includes(term) ||
        customer.name.toLowerCase().includes(term)
      );
    });
  }, [rows, searchTerm, statusFilter]);

  const disruptedCount = rows.filter((r) => r.booking.status !== 'Unaffected').length;

  return (
    <div className="space-y-6">
      {/* Header & FIDS summary */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Ticket className="h-5 w-5 text-sky-400" />
            <h2 className="text-xl font-extrabold text-white tracking-tight">Flight Information Display (FIDS)</h2>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Real-time flight schedule ledger across all registered passengers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>{disruptedCount} Active Disruptions</span>
          </span>
        </div>
      </div>

      {/* Control Bar: Search & Status Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-3 sm:p-4 backdrop-blur-xl">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter by flight, PNR, passenger, or airport code…"
            className="w-full rounded-xl border border-slate-700/80 bg-slate-950 pl-10 pr-4 py-2 text-sm text-white placeholder:text-slate-500 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 focus:outline-none transition-all"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-slate-500 flex items-center gap-1 mr-1">
            <Filter className="h-3 w-3" /> Status:
          </span>
          {(['ALL', 'DISRUPTED', 'DELAYED', 'CANCELLED', 'UNAFFECTED'] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setStatusFilter(filter)}
              className={`rounded-lg px-2.5 py-1 font-semibold transition-all cursor-pointer ${
                statusFilter === filter
                  ? 'bg-sky-500 text-white shadow-sm shadow-sky-500/40'
                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <Loading label="Loading flight board data…" />
      ) : error ? (
        <ErrorState message={error.message} code={error.code} onRetry={reload} />
      ) : (
        <Card className="overflow-hidden border-slate-800 shadow-2xl">
          <CardHeader
            title={`${filteredRows.length} Registered Flights`}
            icon={<Plane className="h-4 w-4 text-sky-400" />}
            meta={`Showing ${filteredRows.length} of ${rows.length} total legs`}
          />
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-950/60 text-xs font-bold tracking-wider text-slate-400 uppercase">
                  <th className="px-5 py-3 font-semibold">Flight</th>
                  <th className="px-5 py-3 font-semibold">Route</th>
                  <th className="px-5 py-3 font-semibold">Passenger / PNR</th>
                  <th className="px-5 py-3 font-semibold">Schedule</th>
                  <th className="px-5 py-3 font-semibold">Operational Status</th>
                  <th className="px-5 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredRows.map(({ booking, customer }) => (
                  <tr
                    key={`${booking.pnr}-${booking.flight}-${booking.date}`}
                    className="hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Flight Code */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-400">
                          <Plane className="h-4 w-4 transform -rotate-45" />
                        </div>
                        <div>
                          <div className="font-mono font-bold text-white text-base">
                            {booking.flight}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {formatDate(booking.date)}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Route */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-200 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                          {booking.route.from}
                        </span>
                        <span className="text-slate-500 font-bold">➔</span>
                        <span className="font-mono font-bold text-slate-200 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                          {booking.route.to}
                        </span>
                      </div>
                    </td>

                    {/* Passenger & Tier */}
                    <td className="px-5 py-4">
                      <div>
                        <Link
                          to={`/customers/${customer.pnr}`}
                          className="font-medium text-white hover:text-sky-300 transition-colors"
                        >
                          {customer.name}
                        </Link>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="font-mono text-xs text-sky-400">
                            {booking.pnr}
                          </span>
                          <Badge tone={loyaltyTone(customer.loyaltyTier)}>
                            {customer.loyaltyTier}
                          </Badge>
                        </div>
                      </div>
                    </td>

                    {/* Departure Timing */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-xs text-slate-300 font-mono">
                          <Clock className="h-3.5 w-3.5 text-slate-500" />
                          <span>Sched: {booking.scheduledDeparture}</span>
                        </div>
                        {booking.status === 'Delayed' ? (
                          <div className="text-xs font-mono font-bold text-amber-300 pl-5">
                            New: {booking.newDeparture}
                          </div>
                        ) : null}
                      </div>
                    </td>

                    {/* Operational Status */}
                    <td className="px-5 py-4">
                      <div>
                        <Badge tone={bookingStatusTone(booking.status)} pulse={booking.status !== 'Unaffected'} size="md">
                          {booking.status.toUpperCase()}
                        </Badge>
                        {booking.status === 'Delayed' ? (
                          <div className="mt-1 text-xs text-amber-300/90 font-medium">
                            +{booking.delayHours} hours delay
                          </div>
                        ) : null}
                        {booking.status === 'Cancelled' ? (
                          <div className="mt-1 text-xs text-rose-300/90 font-medium max-w-xs">
                            {booking.cancellationReason}
                          </div>
                        ) : null}
                      </div>
                    </td>

                    {/* Action Shortcut */}
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      <Link
                        to={`/agent?pnr=${booking.pnr}`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500/15 border border-sky-500/30 px-3 py-1.5 text-xs font-semibold text-sky-300 hover:bg-sky-500 hover:text-white transition-all shadow-sm"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Resolve</span>
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredRows.length === 0 ? (
            <CardBody>
              <div className="py-12 text-center text-slate-400 space-y-1">
                <p className="font-semibold text-white">No flight records match your query.</p>
                <p className="text-xs text-slate-500">Try changing the status filter or clearing your search term.</p>
              </div>
            </CardBody>
          ) : null}
        </Card>
      )}
    </div>
  );
}

