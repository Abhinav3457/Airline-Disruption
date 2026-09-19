import { Link, useParams } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Bot,
  Crown,
  History,
  Mail,
  Phone,
  Plane,
  Ticket,
} from 'lucide-react';

import {
  Badge,
  Button,
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
      {/* Back link */}
      <div>
        <Link
          to="/customers"
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 border border-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-all hover:bg-slate-800 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          <span>Back to Passenger Directory</span>
        </Link>
      </div>

      {loading ? (
        <Loading label="Retrieving passenger dossier…" />
      ) : error ? (
        <ErrorState message={error.message} code={error.code} onRetry={reload} />
      ) : data ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* VIP Loyalty Membership Card & Profile */}
          <div className="space-y-5">
            {/* VIP Card */}
            <div className="relative overflow-hidden rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-950 p-5 sm:p-6 shadow-2xl backdrop-blur-xl">
              <div className="pointer-events-none absolute -right-10 -bottom-10 h-36 w-36 rounded-full bg-indigo-500/10 blur-2xl" />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-indigo-300">
                  <Crown className="h-5 w-5 text-amber-400" />
                  <span className="text-xs font-mono font-bold tracking-wider uppercase">
                    AeroResolve Club
                  </span>
                </div>
                <Badge tone={loyaltyTone(data.loyaltyTier)} size="md">
                  {data.loyaltyTier}
                </Badge>
              </div>

              <div className="mt-6 space-y-1">
                <div className="text-2xl font-bold text-white tracking-tight">
                  {data.name}
                </div>
                <div className="font-mono text-xs text-sky-400">
                  PNR RECORD: {data.pnr}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800/80 grid grid-cols-2 gap-3 text-xs text-slate-300">
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-500">
                    12-Mo Flights
                  </div>
                  <div className="text-lg font-mono font-bold text-white mt-0.5">
                    {data.travelHistory.flightsLast12Months}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-500">
                    Member Status
                  </div>
                  <div className="text-emerald-400 font-semibold mt-0.5">
                    Active &amp; Verified
                  </div>
                </div>
              </div>
            </div>

            {/* Contact details */}
            <Card>
              <CardHeader title="Passenger Contact" />
              <CardBody className="space-y-3 text-xs text-slate-300">
                <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Mail className="h-3.5 w-3.5 text-sky-400" />
                    <span>Email:</span>
                  </div>
                  <span className="font-medium text-white truncate">{data.email}</span>
                </div>
                <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Phone className="h-3.5 w-3.5 text-sky-400" />
                    <span>Phone:</span>
                  </div>
                  <span className="font-medium text-white">{data.phone}</span>
                </div>
              </CardBody>
            </Card>

            {/* Quick Copilot Launch CTA */}
            <Link to={`/agent?pnr=${data.pnr}`} className="block">
              <Button variant="primary" size="lg" className="w-full">
                <Bot className="h-4 w-4" />
                <span>Launch Resolution Copilot</span>
              </Button>
            </Link>

            {/* Historical Complaints */}
            <Card>
              <CardHeader
                title="Complaint History"
                icon={<History className="h-4 w-4 text-sky-400" />}
                meta={`${data.previousComplaints.length} records`}
              />
              <CardBody>
                {data.previousComplaints.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-2 text-center">
                    Clean record — no prior reported disruptions or complaints.
                  </p>
                ) : (
                  <ul className="space-y-2.5">
                    {data.previousComplaints.map((complaint) => (
                      <li
                        key={complaint.issue}
                        className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs space-y-1"
                      >
                        <div className="font-semibold text-white">{complaint.issue}</div>
                        <div className="text-slate-400 flex items-center gap-1.5 pt-1 border-t border-slate-800/80">
                          <span className="text-slate-500">Resolution:</span>
                          <span className="text-emerald-400 font-medium">{complaint.resolution}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </div>

          {/* Bookings column */}
          <div className="space-y-5 lg:col-span-2">
            <Card className="overflow-hidden border-slate-800 shadow-2xl">
              <CardHeader
                title="Registered Booking Legs"
                icon={<Ticket className="h-4 w-4 text-sky-400" />}
                meta={`${data.bookings.length} Flights on Record`}
              />
              <div className="divide-y divide-slate-800/80">
                {data.bookings.map((booking) => (
                  <div
                    key={`${booking.pnr}-${booking.flight}-${booking.date}`}
                    className="p-5 hover:bg-slate-800/30 transition-colors space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-400">
                          <Plane className="h-5 w-5 transform -rotate-45" />
                        </div>
                        <div>
                          <div className="font-mono font-bold text-lg text-white">
                            {booking.flight}
                          </div>
                          <div className="text-xs text-slate-400 flex items-center gap-2">
                            <span>{booking.route.from} ➔ {booking.route.to}</span>
                            <span>·</span>
                            <span>{formatDate(booking.date)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge tone={bookingStatusTone(booking.status)} pulse={booking.status !== 'Unaffected'} size="md">
                          {booking.status.toUpperCase()}
                        </Badge>
                      </div>
                    </div>

                    {/* Flight Timeline details */}
                    <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-950/60 border border-slate-800/80 p-3 text-xs">
                      <div className="space-y-1">
                        <div className="text-slate-500 font-bold uppercase text-[10px]">
                          Scheduled Departure
                        </div>
                        <div className="font-mono text-slate-200 text-sm">
                          {booking.scheduledDeparture}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="text-slate-500 font-bold uppercase text-[10px]">
                          Operational Timing
                        </div>
                        {booking.status === 'Delayed' ? (
                          <div className="font-mono font-bold text-amber-300 text-sm">
                            {booking.newDeparture} (+{booking.delayHours}h Delay)
                          </div>
                        ) : booking.status === 'Cancelled' ? (
                          <div className="font-medium text-rose-300 text-sm">
                            Flight Cancelled
                          </div>
                        ) : (
                          <div className="font-medium text-emerald-400 text-sm">
                            On Schedule
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Disruption detail notice */}
                    {booking.status === 'Cancelled' ? (
                      <div className="flex items-center gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 p-2.5 text-xs text-rose-300">
                        <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                        <span>Reason: {booking.cancellationReason}</span>
                      </div>
                    ) : null}

                    {booking.status === 'Delayed' ? (
                      <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5 text-xs text-amber-300">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                        <span>Delay: {booking.delayHours} hours behind scheduled departure</span>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}

