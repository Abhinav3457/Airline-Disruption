import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Clock,
  Mail,
  MapPin,
  Plane,
  Send,
  Ticket,
  User,
} from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  DecisionPanels,
  ErrorState,
  Loading,
  bookingStatusTone,
  loyaltyTone,
} from '@/components';
import { useApi, useToasts } from '@/hooks';
import { getCustomerByPnr, getCustomers, postAgentChat } from '@/services';
import type { Booking, ChatData, CustomerProfile } from '@/types';
import { formatDate, humanizeIntent } from '@/utils';

interface ChatMessage {
  id: number;
  role: 'user' | 'agent';
  text: string;
}

/** Most disrupted leg: cancellation first, then delay, then the first leg. */
function pickPrimaryBooking(bookings: Booking[]): Booking | null {
  const cancelled = bookings.find((b) => b.status === 'Cancelled');
  if (cancelled) return cancelled;
  const delayed = bookings.find((b) => b.status === 'Delayed');
  if (delayed) return delayed;
  return bookings[0] ?? null;
}

/** Suggested opening message derived from the disruption (no invented data). */
function suggestedMessage(booking: Booking | null): string {
  if (booking?.status === 'Delayed') {
    return `My flight is delayed ${booking.delayHours} hours. What compensation am I entitled to?`;
  }
  if (booking?.status === 'Cancelled') {
    return 'My flight was cancelled. What are my options?';
  }
  return '';
}

/** Customer + primary booking context for the selected PNR. */
function CustomerContext({ profile }: { profile: CustomerProfile }) {
  const primary = pickPrimaryBooking(profile.bookings);

  return (
    <Card>
      <CardHeader
        title="Selected customer"
        meta={`PNR ${profile.pnr}`}
      />
      <CardBody className="space-y-4">
        {/* Identity row */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-ops-accent/15">
            <User className="h-5 w-5 text-ops-accent" aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold">{profile.name}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <Badge tone={loyaltyTone(profile.loyaltyTier)}>
                {profile.loyaltyTier}
              </Badge>
              <span className="font-mono text-xs text-ops-muted">
                {profile.pnr}
              </span>
            </div>
          </div>
        </div>

        {/* Contact details */}
        <div className="grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-2">
          <div className="flex items-center gap-2 text-ops-muted">
            <Mail className="h-3.5 w-3.5" aria-hidden />
            <span className="truncate">{profile.email}</span>
          </div>
          <div className="flex items-center gap-2 text-ops-muted">
            <Ticket className="h-3.5 w-3.5" aria-hidden />
            {profile.phone}
          </div>
        </div>

        {/* Primary booking / disruption */}
        {primary ? (
          <div className="rounded-md border border-ops-line bg-ops-800/50 px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-ops-accent/10">
                  <Plane className="h-4 w-4 text-ops-accent" aria-hidden />
                </span>
                <div>
                  <div className="text-sm font-medium">
                    {primary.flight} · {primary.route.from} →{' '}
                    {primary.route.to}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-ops-muted">
                    <MapPin className="h-3 w-3" aria-hidden />
                    {formatDate(primary.date)}
                    <span className="text-ops-faint">·</span>
                    <Clock className="h-3 w-3" aria-hidden />
                    sched {primary.scheduledDeparture}
                    {primary.status === 'Delayed' ? (
                      <>
                        <span className="text-ops-faint">→</span>
                        updated {primary.newDeparture}
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
              <Badge tone={bookingStatusTone(primary.status)}>
                {primary.status}
              </Badge>
            </div>

            {primary.status === 'Cancelled' ? (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-red-300/90">
                <AlertTriangle className="h-3 w-3" aria-hidden />
                Reason: {primary.cancellationReason}
              </div>
            ) : null}
            {primary.status === 'Delayed' ? (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-300/90">
                <Clock className="h-3 w-3" aria-hidden />
                {primary.delayHours}-hour delay · departure moved to{' '}
                {primary.newDeparture}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Previous complaints, if any */}
        {profile.previousComplaints.length > 0 ? (
          <div>
            <div className="text-xs font-medium tracking-wide text-ops-muted uppercase">
              Previous complaint
            </div>
            <ul className="mt-1.5 space-y-1.5">
              {profile.previousComplaints.map((complaint) => (
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
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

export function AgentPage() {
  const customers = useApi(() => getCustomers(), 'agent-customers');
  const [selectedPnr, setSelectedPnr] = useState<string>('');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [latest, setLatest] = useState<ChatData | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const { pushToast } = useToasts();

  // Customer + bookings for the selected PNR (backend-driven).
  const profile = useApi(
    () => getCustomerByPnr(selectedPnr),
    selectedPnr || null
  );

  // Reset the conversation when the operator switches customer.
  useEffect(() => {
    setMessages([]);
    setLatest(null);
    setInput('');
  }, [selectedPnr]);

  // Keep the newest message visible.
  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [messages]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmedPnr = selectedPnr.trim();
    const trimmedMessage = input.trim();

    if (!trimmedPnr) {
      pushToast('error', 'Select a customer first.');
      return;
    }
    if (!trimmedMessage) {
      pushToast('error', 'Type a message for the agent.');
      return;
    }

    setSending(true);
    try {
      const data = await postAgentChat({
        pnr: trimmedPnr,
        message: trimmedMessage,
      });
      setMessages((current) => [
        ...current,
        { id: Date.now(), role: 'user', text: trimmedMessage },
        { id: Date.now() + 1, role: 'agent', text: data.message },
      ]);
      setLatest(data);
      setInput('');
    } catch (error) {
      pushToast(
        'error',
        error instanceof Error ? error.message : 'The agent could not be reached.'
      );
    } finally {
      setSending(false);
    }
  }

  const profileData = profile.data;
  const suggestion = suggestedMessage(pickPrimaryBooking(profileData?.bookings ?? []));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Customer Agent</h2>
        <p className="mt-1 text-sm text-ops-muted">
          Select a customer, review their disruption context, and let the agent
          resolve it. All data is loaded live from the backend.
        </p>
      </div>

      {/* Customer selector */}
      <Card>
        <CardBody className="flex flex-wrap items-center gap-3">
          <label
            htmlFor="customer-select"
            className="text-xs font-medium tracking-wide text-ops-muted uppercase"
          >
            Customer
          </label>
          {customers.loading ? (
            <Loading inline label="Loading customers…" />
          ) : customers.error ? (
            <ErrorState
              message={customers.error.message}
              code={customers.error.code}
              onRetry={customers.reload}
            />
          ) : (
            <select
              id="customer-select"
              value={selectedPnr}
              onChange={(event) => setSelectedPnr(event.target.value)}
              className="min-w-56 flex-1 rounded-md border border-ops-line bg-ops-800 px-3 py-2 text-sm text-ops-text focus:border-ops-accent focus:outline-none sm:max-w-md"
            >
              <option value="">Select a customer…</option>
              {(customers.data ?? []).map((customer) => (
                <option key={customer.pnr} value={customer.pnr}>
                  {customer.name} — {customer.pnr} ({customer.loyaltyTier})
                </option>
              ))}
            </select>
          )}
        </CardBody>
      </Card>

      {!selectedPnr ? (
        <Card>
          <CardBody className="py-10 text-center text-sm text-ops-faint">
            Select a customer above to load their booking context and start a
            conversation.
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
          {/* Context + conversation */}
          <div className="space-y-4 xl:col-span-3">
            {profile.loading ? (
              <Loading label="Loading customer context…" />
            ) : profile.error ? (
              <ErrorState
                message={profile.error.message}
                code={profile.error.code}
                onRetry={profile.reload}
              />
            ) : profileData ? (
              <CustomerContext profile={profileData} />
            ) : null}

            <Card>
              <CardHeader title="Conversation" />
              <div
                ref={threadRef}
                className="h-80 space-y-3 overflow-y-auto px-4 py-3"
              >
                {messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center text-sm text-ops-faint">
                    <p>No messages yet.</p>
                    {suggestion ? (
                      <button
                        type="button"
                        className="mt-2 rounded-md border border-ops-line bg-ops-800 px-3 py-1.5 text-xs text-ops-muted transition-colors hover:text-ops-text"
                        onClick={() => setInput(suggestion)}
                      >
                        Use suggested opener: “{suggestion}”
                      </button>
                    ) : null}
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.role === 'user' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg px-3.5 py-2.5 text-sm ${
                          message.role === 'user'
                            ? 'bg-ops-accent/20 text-ops-text'
                            : 'border border-ops-line bg-ops-800/70 text-ops-text'
                        }`}
                      >
                        {message.text}
                      </div>
                    </div>
                  ))
                )}
              </div>
              <form
                onSubmit={handleSubmit}
                className="border-t border-ops-line px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <input
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder="Describe the issue…"
                    className="flex-1 rounded-md border border-ops-line bg-ops-800 px-3 py-2 text-sm text-ops-text placeholder:text-ops-faint focus:border-ops-accent focus:outline-none"
                  />
                  <Button type="submit" disabled={sending || !selectedPnr}>
                    <Send className="h-3.5 w-3.5" aria-hidden />
                    {sending ? 'Sending…' : 'Send'}
                  </Button>
                </div>
              </form>
            </Card>
          </div>

          {/* Verdict panels */}
          <div className="xl:col-span-2">
            {latest ? (
              <DecisionPanels data={latest} />
            ) : (
              <Card>
                <CardBody className="text-sm text-ops-muted">
                  Send a message to see the policy decision, executed actions,
                  and any escalation here.
                </CardBody>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
