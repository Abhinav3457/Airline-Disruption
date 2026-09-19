import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bot,
  Mail,
  Phone,
  Search,
  Users,
} from 'lucide-react';

import { Badge, Card, CardBody, CardHeader, ErrorState, Loading, loyaltyTone } from '@/components';
import { useApi } from '@/hooks';
import { getCustomers } from '@/services';

export function CustomersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const { data, error, loading, reload } = useApi(() => getCustomers(), 'customers');

  const filteredCustomers = useMemo(() => {
    if (!data) return [];
    if (!searchTerm.trim()) return data;
    const term = searchTerm.toLowerCase();
    return data.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.pnr.toLowerCase().includes(term) ||
        c.email.toLowerCase().includes(term) ||
        c.phone.includes(term) ||
        c.loyaltyTier.toLowerCase().includes(term)
    );
  }, [data, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-sky-400" />
            <h2 className="text-xl font-extrabold text-white tracking-tight">Passenger Register &amp; Loyalty Directory</h2>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Registered customer passenger profiles, loyalty tiers, travel volume, and complaint history.
          </p>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by passenger name, PNR, email, or loyalty tier…"
          className="w-full rounded-xl border border-slate-700/80 bg-slate-900/80 pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 focus:outline-none transition-all shadow-sm"
        />
      </div>

      {loading ? (
        <Loading label="Loading registered passengers…" />
      ) : error ? (
        <ErrorState message={error.message} code={error.code} onRetry={reload} />
      ) : data ? (
        <Card className="overflow-hidden border-slate-800 shadow-2xl">
          <CardHeader
            title={`${filteredCustomers.length} Passengers`}
            icon={<Users className="h-4 w-4 text-sky-400" />}
            meta="GET /api/customers"
          />
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-950/60 text-xs font-bold tracking-wider text-slate-400 uppercase">
                  <th className="px-5 py-3.5 font-semibold">Passenger Profile</th>
                  <th className="px-5 py-3.5 font-semibold">PNR</th>
                  <th className="px-5 py-3.5 font-semibold">Loyalty Status</th>
                  <th className="px-5 py-3.5 font-semibold">Contact Details</th>
                  <th className="px-5 py-3.5 font-semibold">12-Mo Flights</th>
                  <th className="px-5 py-3.5 font-semibold">Historical Complaints</th>
                  <th className="px-5 py-3.5 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredCustomers.map((customer) => (
                  <tr
                    key={customer.pnr}
                    className="hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="px-5 py-4">
                      <Link
                        to={`/customers/${customer.pnr}`}
                        className="font-bold text-white hover:text-sky-300 transition-colors text-base"
                      >
                        {customer.name}
                      </Link>
                      <div className="text-[11px] text-slate-400">
                        {customer.travelHistory.flightsLast12Months} flights / 12 mo
                      </div>
                    </td>

                    <td className="px-5 py-4 font-mono font-bold text-xs text-sky-400">
                      {customer.pnr}
                    </td>

                    <td className="px-5 py-4">
                      <Badge tone={loyaltyTone(customer.loyaltyTier)} size="md">
                        {customer.loyaltyTier}
                      </Badge>
                    </td>

                    <td className="px-5 py-4 text-slate-300 text-xs space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Mail className="h-3 w-3 text-slate-500" />
                        <span>{customer.email}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Phone className="h-3 w-3 text-slate-500" />
                        <span>{customer.phone}</span>
                      </div>
                    </td>

                    <td className="px-5 py-4 font-mono font-bold text-slate-200">
                      {customer.travelHistory.flightsLast12Months}
                    </td>

                    <td className="max-w-[220px] truncate px-5 py-4 text-xs text-slate-400">
                      {customer.previousComplaints.length === 0 ? (
                        <span className="text-slate-500 italic">No prior issues</span>
                      ) : (
                        <span title={customer.previousComplaints.map((c) => c.issue).join(', ')}>
                          {customer.previousComplaints.map((c) => c.issue).join(', ')}
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/agent?pnr=${customer.pnr}`}
                          className="inline-flex items-center gap-1 rounded-lg bg-sky-500/15 border border-sky-500/30 px-2.5 py-1 text-xs font-semibold text-sky-300 hover:bg-sky-500 hover:text-white transition-all shadow-sm"
                          title="Open in AI Copilot"
                        >
                          <Bot className="h-3.5 w-3.5" />
                          <span>Copilot</span>
                        </Link>
                        <Link
                          to={`/customers/${customer.pnr}`}
                          className="inline-flex items-center rounded-lg bg-slate-800/80 border border-slate-700/80 p-1 text-slate-400 hover:text-white hover:bg-slate-700 transition-all"
                          title="View Profile"
                        >
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredCustomers.length === 0 ? (
            <CardBody>
              <div className="py-12 text-center text-slate-400 space-y-1">
                <p className="font-semibold text-white">No passengers match your search.</p>
                <p className="text-xs text-slate-500">Try clearing the search filter.</p>
              </div>
            </CardBody>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}

