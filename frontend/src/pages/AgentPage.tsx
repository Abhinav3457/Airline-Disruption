import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Play, Send, Sparkles } from 'lucide-react';

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
import { formatDate } from '@/utils';

interface ChatMessage {
  id: number;
  role: 'user' | 'agent';
  text: string;
}

/** Quick scenarios (verbatim asks); the customer is resolved from the backend list. */
const SCENARIOS: Array<{ label: string; text: string }> = [
  {
    label: 'Priya',
    text: 'Flight SK-204 was cancelled. I want a full cash refund and a free business-class upgrade on my return flight.',
  },
  {
    label: 'Arvind',
    text: 'My flight is delayed by 4 hours and I missed an important meeting. I want a hotel.',
  },
  {
    label: 'Meher',
    text: 'My flight is delayed by 6 hours. Give me a full-night hotel and waive the ₹2,000 fare difference.',
  },
];

/** Most disrupted leg: cancellation first, then delay, then the first leg. */
function pickPrimaryBooking(bookings: Booking[]): Booking | null {
  const cancelled = bookings.find((b) => b.status === 'Cancelled');
  if (cancelled) return cancelled;
  const delayed = bookings.find((b) => b.status === 'Delayed');
  if (delayed) return delayed;
  return bookings[0] ?? null;
}

/** Selected customer information panel (left column). */
function CustomerContext({ profile }: { profile: CustomerProfile }) {
  const primary = pickPrimaryBooking(profile.bookings);

  return (
    <Card>
      <CardHeader title="Selected customer" meta={`PNR ${profile.pnr}`} />
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
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

        <div className="grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-2">
          <div className="truncate text-ops-muted">{profile.email}</div>
          <div className="text-ops-muted">{profile.phone}</div>
        </div>

        {primary ? (
          <div className="rounded-md border border-ops-line bg-ops-800/50 px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-medium">
                  {primary.flight} · {primary.route.from} →{' '}
                  {primary.route.to}
                </div>
                <div className="text-xs text-ops-muted">
                  {formatDate(primary.date)} · sched{' '}
                  {primary.scheduledDeparture}
                  {primary.status === 'Delayed'
                    ? ` → updated ${primary.newDeparture}`
                    : ''}
                </div>
              </div>
              <Badge tone={bookingStatusTone(primary.status)}>
                {primary.status}
              </Badge>
            </div>
            {primary.status === 'Cancelled' ? (
              <div className="mt-2 text-xs text-red-300/90">
                Reason: {primary.cancellationReason}
              </div>
            ) : null}
            {primary.status === 'Delayed' ? (
              <div className="mt-2 text-xs text-amber-300/90">
                {primary.delayHours}-hour delay · departure moved to{' '}
                {primary.newDeparture}
              </div>
            ) : null}
          </div>
        ) : null}

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

/** Typing indicator: agent-side bubble with pulsing dots. */
function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1.5 rounded-lg border border-ops-line bg-ops-800/70 px-3.5 py-2.5">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="h-1.5 w-1.5 animate-pulse rounded-full bg-ops-muted"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
        <span className="ml-1 text-xs text-ops-faint">
          agent is resolving…
        </span>
      </div>
    </div>
  );
}

export function AgentPage() {
  const customers = useApi(() => getCustomers(), 'agent-customers');
  const [searchParams] = useSearchParams();
  const [selectedPnr, setSelectedPnr] = useState<string>(
    searchParams.get('pnr') ?? ''
  );
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [latest, setLatest] = useState<ChatData | null>(null);
  /** Scenario queued while the customer switch is applied. */
  const [pendingScenario, setPendingScenario] = useState<{
    pnr: string;
    text: string;
  } | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const { pushToast } = useToasts();

  // Customer + bookings for the selected PNR (backend-driven).
  const profile = useApi(
    () => getCustomerByPnr(selectedPnr),
    selectedPnr || null
  );

  /** Shared sender for typed messages and scenario runs. */
  const sendMessage = useCallback(
    async (text: string, pnr: string) => {
      setSending(true);
      try {
        const data = await postAgentChat({ pnr, message: text });
        setMessages((current) => [
          ...current,
          { id: Date.now(), role: 'user', text },
          { id: Date.now() + 1, role: 'agent', text: data.message },
        ]);
        setLatest(data);
      } catch (error) {
        pushToast(
          'error',
          error instanceof Error
            ? error.message
            : 'The agent could not be reached.'
        );
      } finally {
        setSending(false);
      }
    },
    [pushToast]
  );

  // Reset the conversation when the operator switches customer.
  useEffect(() => {
    setMessages([]);
    setLatest(null);
    setInput('');
  }, [selectedPnr]);

  // Run a queued scenario once its customer is selected.
  useEffect(() => {
    if (!pendingScenario || pendingScenario.pnr !== selectedPnr) return;
    const { text } = pendingScenario;
    setPendingScenario(null);
    void sendMessage(text, selectedPnr);
  }, [pendingScenario, selectedPnr, sendMessage]);

  // Auto-scroll to the latest message (and while the agent "types").
  useEffect(() => {
    const element = threadRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages, sending]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmedMessage = input.trim();
    if (!selectedPnr) {
      pushToast('error', 'Select a customer first.');
      return;
    }
    if (!trimmedMessage) {
      pushToast('error', 'Type a message for the agent.');
      return;
    }
    setInput('');
    await sendMessage(trimmedMessage, selectedPnr);
  }

  function runScenario(scenario: (typeof SCENARIOS)[number]) {
    const match = (customers.data ?? []).find((customer) =>
      customer.name.startsWith(scenario.label)
    );
    if (!match) {
      pushToast('error', `Customer "${scenario.label}" not found in the backend.`);
      return;
    }
    if (selectedPnr === match.pnr) {
      // Same customer: send immediately.
      void sendMessage(scenario.text, match.pnr);
    } else {
      setSelectedPnr(match.pnr);
      setPendingScenario({ pnr: match.pnr, text: scenario.text });
    }
  }

  const profileData = profile.data;
  const activeScenarioLabel = (customers.data ?? []).find(
    (customer) => customer.pnr === selectedPnr
  )?.name.split(' ')[0];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Customer Resolution Agent</h2>
        <p className="mt-1 text-sm text-ops-muted">
          The backend's deterministic policy engine decides everything — this
          screen only displays its verdicts.
        </p>
      </div>

      {/* Customer selector + quick scenarios */}
      <Card>
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
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
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-ops-muted uppercase">
              <Sparkles className="h-3.5 w-3.5" aria-hidden /> Quick scenarios
            </span>
            {SCENARIOS.map((scenario) => {
              const disabled =
                customers.loading || sending || !customers.data;
              return (
                <Button
                  key={scenario.label}
                  size="sm"
                  variant="secondary"
                  disabled={disabled}
                  onClick={() => runScenario(scenario)}
                  title={scenario.text}
                >
                  <Play className="h-3 w-3" aria-hidden />
                  {scenario.label}
                  {activeScenarioLabel === scenario.label ? ' ✓' : ''}
                </Button>
              );
            })}
          </div>
        </CardBody>
      </Card>

      {!selectedPnr ? (
        <Card>
          <CardBody className="py-10 text-center text-sm text-ops-faint">
            Select a customer (or run a quick scenario) to load their context
            and start resolving.
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
          {/* Left/main: customer info + conversation */}
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
              <CardHeader title="Chat" meta={`${messages.length} messages`} />
              <div
                ref={threadRef}
                className="h-96 space-y-3 overflow-y-auto px-4 py-3"
              >
                {messages.length === 0 && !sending ? (
                  <div className="flex h-full flex-col items-center justify-center text-center text-sm text-ops-faint">
                    <p>No messages yet.</p>
                    <p className="mt-1">
                      Type below or run a quick scenario to see the agent
                      resolve it.
                    </p>
                  </div>
                ) : (
                  <>
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${
                          message.role === 'user'
                            ? 'justify-end'
                            : 'justify-start'
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
                    ))}
                    {sending ? <TypingIndicator /> : null}
                  </>
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

          {/* Right: decision rail */}
          <div className="xl:col-span-2">
            {latest ? (
              <DecisionPanels data={latest} />
            ) : (
              <Card>
                <CardBody className="text-sm text-ops-muted">
                  The decision summary, intent, booking details, allowed vs
                  rejected actions, escalation status, and audit ID appear here
                  after the first exchange.
                </CardBody>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
