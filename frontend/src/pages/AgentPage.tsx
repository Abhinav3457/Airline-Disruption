import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  Bot,
  Calendar,
  Clock,
  CornerDownLeft,
  History,
  Mail,
  MapPin,
  Phone,
  Plane,
  Play,
  Send,
  Sparkles,
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
import { formatDate } from '@/utils';

interface ChatMessage {
  id: number;
  role: 'user' | 'agent';
  text: string;
  time?: string;
}

/** Quick scenarios (verbatim asks); the customer is resolved from the backend list. */
const SCENARIOS: Array<{
  label: string;
  flight: string;
  disruption: string;
  text: string;
}> = [
  {
    label: 'Priya',
    flight: 'SK-204',
    disruption: 'Cancelled',
    text: 'Flight SK-204 was cancelled. I want a full cash refund and a free business-class upgrade on my return flight.',
  },
  {
    label: 'Arvind',
    flight: 'AI-102',
    disruption: '4h Delay',
    text: 'My flight is delayed by 4 hours and I missed an important meeting. I want a hotel.',
  },
  {
    label: 'Meher',
    flight: '6E-554',
    disruption: '6h Delay',
    text: 'My flight is delayed by 6 hours. Give me a full-night hotel and waive the ₹2,000 fare difference.',
  },
];

const PROMPT_SUGGESTIONS = [
  'I want a full cash refund to my original payment method.',
  'Am I eligible for a complimentary hotel stay and food vouchers?',
  'Please waive the ₹2,000 fare difference for my next flight.',
  'Can I get a complimentary upgrade to Business Class?',
];

/** Most disrupted leg: cancellation first, then delay, then the first leg. */
function pickPrimaryBooking(bookings: Booking[]): Booking | null {
  const cancelled = bookings.find((b) => b.status === 'Cancelled');
  if (cancelled) return cancelled;
  const delayed = bookings.find((b) => b.status === 'Delayed');
  if (delayed) return delayed;
  return bookings[0] ?? null;
}

/** Selected customer flight boarding pass & context card (left column). */
function CustomerContext({ profile }: { profile: CustomerProfile }) {
  const primary = pickPrimaryBooking(profile.bookings);

  return (
    <div className="space-y-4">
      {/* 1. Airline Boarding Pass / Disrupted Flight Card */}
      {primary ? (
        <div className="relative overflow-hidden rounded-2xl border border-sky-500/30 bg-gradient-to-b from-slate-900 via-slate-900/90 to-slate-950 p-5 shadow-xl backdrop-blur-xl">
          {/* Subtle decorative background airplane */}
          <Plane className="pointer-events-none absolute -right-6 -bottom-6 h-36 w-36 text-sky-500/5 transform -rotate-12" />

          {/* Ticket Header */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3.5">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400">
                <Ticket className="h-4 w-4" />
              </span>
              <div>
                <span className="text-xs font-mono font-bold text-sky-400 tracking-wider">
                  FLIGHT TICKET
                </span>
                <span className="text-xs text-slate-500 font-mono ml-2">
                  #{primary.flight}
                </span>
              </div>
            </div>
            <Badge tone={bookingStatusTone(primary.status)} pulse size="md">
              {primary.status.toUpperCase()}
            </Badge>
          </div>

          {/* Flight Route Visualizer */}
          <div className="py-4 flex items-center justify-between">
            {/* Origin */}
            <div className="space-y-0.5">
              <div className="text-3xl font-extrabold font-mono tracking-tight text-white">
                {primary.route.from}
              </div>
              <div className="text-[11px] text-slate-400 flex items-center gap-1">
                <MapPin className="h-3 w-3 text-sky-400" />
                <span>Origin Airport</span>
              </div>
            </div>

            {/* Flight Path with Animated Plane */}
            <div className="flex-1 px-4 flex flex-col items-center">
              <div className="relative w-full flex items-center justify-center">
                <div className="w-full h-[1px] bg-gradient-to-r from-sky-500/20 via-sky-400 to-sky-500/20" />
                <div className="absolute flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 border border-sky-400/60 shadow-[0_0_10px_rgba(56,189,248,0.5)]">
                  <Plane className="h-3 w-3 text-sky-400 transform rotate-90" />
                </div>
              </div>
              <span className="text-[10px] font-mono text-sky-400/80 mt-1 font-semibold">
                NON-STOP
              </span>
            </div>

            {/* Destination */}
            <div className="space-y-0.5 text-right">
              <div className="text-3xl font-extrabold font-mono tracking-tight text-white">
                {primary.route.to}
              </div>
              <div className="text-[11px] text-slate-400 flex items-center justify-end gap-1">
                <MapPin className="h-3 w-3 text-sky-400" />
                <span>Destination</span>
              </div>
            </div>
          </div>

          {/* Schedule & Timing Matrix */}
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-950/70 border border-slate-800/80 p-3 text-xs">
            <div className="space-y-1">
              <div className="text-slate-500 text-[10px] uppercase font-bold tracking-wider flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Flight Date
              </div>
              <div className="text-slate-200 font-medium">
                {formatDate(primary.date)}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-slate-500 text-[10px] uppercase font-bold tracking-wider flex items-center gap-1">
                <Clock className="h-3 w-3" /> Scheduled Dep
              </div>
              <div className="text-slate-200 font-mono font-medium">
                {primary.scheduledDeparture}
              </div>
            </div>
          </div>

          {/* Disruption Alert Box */}
          {primary.status === 'Cancelled' ? (
            <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              <div>
                <span className="font-bold">Cancellation Confirmed:</span>{' '}
                <span>{primary.cancellationReason}</span>
              </div>
            </div>
          ) : null}

          {primary.status === 'Delayed' ? (
            <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
              <div>
                <span className="font-bold">{primary.delayHours}-Hour Disruption Delay:</span>{' '}
                <span>Departure moved to <strong className="text-white font-mono">{primary.newDeparture}</strong></span>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* 2. Customer Passenger Dossier */}
      <Card>
        <CardHeader
          title="Passenger Dossier"
          icon={<User className="h-4 w-4 text-sky-400" />}
          meta={
            <span className="font-mono text-xs text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
              PNR {profile.pnr}
            </span>
          }
        />
        <CardBody className="space-y-3.5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base font-bold text-white">{profile.name}</div>
              <div className="text-xs text-slate-400 mt-0.5">
                {profile.travelHistory.flightsLast12Months} flights in past 12 months
              </div>
            </div>
            <Badge tone={loyaltyTone(profile.loyaltyTier)} size="md">
              {profile.loyaltyTier}
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300 pt-2 border-t border-slate-800/80">
            <div className="flex items-center gap-1.5 truncate">
              <Mail className="h-3.5 w-3.5 text-slate-500 shrink-0" />
              <span className="truncate">{profile.email}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-slate-500 shrink-0" />
              <span>{profile.phone}</span>
            </div>
          </div>

          {/* Historical Complaints */}
          {profile.previousComplaints.length > 0 ? (
            <div className="pt-2 border-t border-slate-800/80 space-y-2">
              <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                <History className="h-3 w-3 text-sky-400" />
                <span>Historical Complaints ({profile.previousComplaints.length})</span>
              </div>
              <ul className="space-y-1.5">
                {profile.previousComplaints.map((c) => (
                  <li
                    key={c.issue}
                    className="rounded-lg border border-slate-800 bg-slate-950/60 p-2 text-xs"
                  >
                    <div className="text-slate-200 font-medium">{c.issue}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Resolution: <span className="text-emerald-400 font-medium">{c.resolution}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}

/** Typing indicator: agent-side bubble with pulsing wave dots. */
function TypingIndicator() {
  return (
    <div className="flex justify-start items-end gap-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-500/20 border border-sky-400/40 text-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.4)]">
        <Bot className="h-4 w-4" />
      </div>
      <div className="flex items-center gap-2 rounded-2xl border border-sky-500/30 bg-slate-900/90 px-4 py-3 shadow-lg">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="h-2 w-2 animate-bounce rounded-full bg-sky-400"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
        <span className="ml-1 text-xs font-medium text-sky-300">
          Policy Engine evaluating entitlements…
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
  const sendingRef = useRef(false);
  const [latest, setLatest] = useState<ChatData | null>(null);
  const [pendingScenario, setPendingScenario] = useState<{
    pnr: string;
    text: string;
  } | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const { pushToast } = useToasts();

  // Customer + bookings for the selected PNR.
  const profile = useApi(
    () => getCustomerByPnr(selectedPnr),
    selectedPnr || null
  );

  /** Shared sender for typed messages and scenario runs. */
  const sendMessage = useCallback(
    async (text: string, pnr: string) => {
      if (sendingRef.current) return;
      sendingRef.current = true;
      setSending(true);
      const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      try {
        const data = await postAgentChat({ pnr, message: text });
        setMessages((current) => [
          ...current,
          { id: Date.now(), role: 'user', text, time: currentTime },
          { id: Date.now() + 1, role: 'agent', text: data.message, time: currentTime },
        ]);
        setLatest(data);
      } catch (error) {
        pushToast(
          'error',
          error instanceof Error
            ? error.message
            : 'The resolution agent could not be reached.'
        );
      } finally {
        sendingRef.current = false;
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

  // Auto-scroll to the latest message.
  useEffect(() => {
    const element = threadRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages, sending]);

  async function submitMessage(customText?: string) {
    const textToSend = customText ?? input.trim();
    if (sending) return;
    if (!selectedPnr) {
      pushToast('error', 'Select a passenger first.');
      return;
    }
    if (!textToSend) {
      pushToast('error', 'Type a message for the agent.');
      return;
    }
    setInput('');
    await sendMessage(textToSend, selectedPnr);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    await submitMessage();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void submitMessage();
    }
  }

  function runScenario(scenario: (typeof SCENARIOS)[number]) {
    const match = (customers.data ?? []).find((customer) =>
      customer.name.startsWith(scenario.label)
    );
    if (!match) {
      pushToast('error', `Passenger "${scenario.label}" not found.`);
      return;
    }
    if (selectedPnr === match.pnr) {
      void sendMessage(scenario.text, match.pnr);
    } else {
      setSelectedPnr(match.pnr);
      setPendingScenario({ pnr: match.pnr, text: scenario.text });
    }
  }

  const profileData = profile.data;
  const activeCustomer = (customers.data ?? []).find(
    (customer) => customer.pnr === selectedPnr
  );

  return (
    <div className="space-y-6">
      {/* 1. Cockpit Command Bar: Passenger Selector & Quick Simulation Scenarios */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5 backdrop-blur-xl shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Passenger Selector */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <label
              htmlFor="customer-select"
              className="text-xs font-bold tracking-wider text-slate-400 uppercase shrink-0 flex items-center gap-1.5"
            >
              <User className="h-3.5 w-3.5 text-sky-400" />
              <span>Target Passenger:</span>
            </label>

            {customers.loading ? (
              <Loading inline label="Loading passengers…" />
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
                className="flex-1 max-w-md rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm font-medium text-white focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 focus:outline-none transition-all cursor-pointer"
              >
                <option value="">Select a passenger to begin resolution…</option>
                {(customers.data ?? []).map((customer) => (
                  <option key={customer.pnr} value={customer.pnr}>
                    {customer.name} — PNR {customer.pnr} ({customer.loyaltyTier} Tier)
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Quick Simulation Scenarios */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold tracking-wider text-slate-400 uppercase flex items-center gap-1.5 mr-1">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              <span>1-Click Scenarios:</span>
            </span>

            {SCENARIOS.map((scenario) => {
              const disabled = customers.loading || sending || !customers.data;
              const isActive = activeCustomer?.name.startsWith(scenario.label);
              return (
                <button
                  key={scenario.label}
                  type="button"
                  disabled={disabled}
                  onClick={() => runScenario(scenario)}
                  className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30'
                      : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 hover:text-white'
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                  title={scenario.text}
                >
                  <Play className="h-3 w-3" />
                  <span>{scenario.label} ({scenario.flight})</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                    scenario.disruption === 'Cancelled' ? 'bg-rose-500/30 text-rose-200' : 'bg-amber-500/30 text-amber-200'
                  }`}>
                    {scenario.disruption}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {!selectedPnr ? (
        <Card>
          <CardBody className="py-16 text-center space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 shadow-[0_0_25px_-5px_rgba(56,189,248,0.3)]">
              <Bot className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-bold text-white">Select a Passenger or Run a Scenario</h3>
            <p className="max-w-md mx-auto text-sm text-slate-400">
              Pick a passenger profile above (or click one of the quick scenario buttons for Priya, Arvind, or Meher) to inspect their disrupted flight and test the AI policy engine.
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
          {/* Left column: Passenger Flight Ticket & Context */}
          <div className="space-y-4 xl:col-span-3">
            {profile.loading ? (
              <Loading label="Retrieving passenger flight context…" />
            ) : profile.error ? (
              <ErrorState
                message={profile.error.message}
                code={profile.error.code}
                onRetry={profile.reload}
              />
            ) : profileData ? (
              <CustomerContext profile={profileData} />
            ) : null}

            {/* AI Resolution Chat Terminal */}
            <Card className="overflow-hidden border-sky-500/20 shadow-2xl">
              <CardHeader
                title="Resolution Interaction Terminal"
                icon={<Bot className="h-4 w-4 text-sky-400" />}
                meta={
                  <span className="text-xs text-slate-400 font-mono">
                    {messages.length} exchanges · Active Thread
                  </span>
                }
              />

              {/* Chat Thread Messages */}
              <div
                ref={threadRef}
                className="h-[420px] space-y-4 overflow-y-auto p-4 sm:p-5 bg-slate-950/40"
              >
                {messages.length === 0 && !sending ? (
                  <div className="flex h-full flex-col items-center justify-center text-center space-y-2 text-slate-400">
                    <Bot className="h-8 w-8 text-slate-600 animate-pulse" />
                    <p className="text-sm font-medium text-slate-300">Ready to assist passenger.</p>
                    <p className="text-xs text-slate-500 max-w-sm">
                      Type the customer inquiry below or pick one of the recommended simulation prompts.
                    </p>
                  </div>
                ) : (
                  <>
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex items-end gap-2.5 ${
                          message.role === 'user' ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        {message.role === 'agent' ? (
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-500/20 border border-sky-400/40 text-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.3)]">
                            <Bot className="h-4 w-4" />
                          </div>
                        ) : null}

                        <div
                          className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-md ${
                            message.role === 'user'
                              ? 'bg-gradient-to-r from-sky-600 to-blue-600 text-white rounded-br-xs'
                              : 'border border-slate-800 bg-slate-900/90 text-slate-100 rounded-bl-xs'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-4 text-[10px] pb-1 mb-1 border-b opacity-60">
                            <span className="font-bold uppercase tracking-wider">
                              {message.role === 'user' ? (activeCustomer?.name ?? 'Passenger') : 'AeroResolve Copilot'}
                            </span>
                            {message.time ? <span>{message.time}</span> : null}
                          </div>
                          <div className="whitespace-pre-wrap">{message.text}</div>
                        </div>

                        {message.role === 'user' ? (
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                            <User className="h-4 w-4" />
                          </div>
                        ) : null}
                      </div>
                    ))}
                    {sending ? <TypingIndicator /> : null}
                  </>
                )}
              </div>

              {/* Quick Suggestion Chips */}
              <div className="px-4 py-2.5 bg-slate-900/70 border-t border-slate-800/80 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase mr-1">
                  Quick Prompts:
                </span>
                {PROMPT_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    disabled={sending}
                    onClick={() => void submitMessage(suggestion)}
                    className="rounded-lg bg-slate-800/80 border border-slate-700/60 px-2.5 py-1 text-[11px] text-slate-300 hover:text-white hover:border-sky-500/40 hover:bg-sky-500/15 transition-all cursor-pointer disabled:opacity-40"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>

              {/* Message Input Bar */}
              <form
                onSubmit={handleSubmit}
                className="border-t border-slate-800/80 p-3 sm:p-4 bg-slate-900/90"
              >
                <div className="flex items-end gap-2.5">
                  <div className="relative flex-1">
                    <textarea
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      onKeyDown={handleKeyDown}
                      rows={1}
                      disabled={sending}
                      placeholder="Describe the disruption or type passenger request… (Enter to send)"
                      className="max-h-32 min-h-[46px] w-full resize-none rounded-xl border border-slate-700/80 bg-slate-950 px-3.5 py-3 text-sm text-white placeholder:text-slate-500 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 focus:outline-none disabled:opacity-50 transition-all"
                    />
                    <div className="hidden sm:flex absolute right-3 bottom-2.5 items-center gap-1 text-[10px] text-slate-500 pointer-events-none">
                      <span>Shift + Enter</span>
                      <CornerDownLeft className="h-3 w-3" />
                      <span>newline</span>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    disabled={sending || !selectedPnr}
                    className="h-[46px] px-5 shrink-0"
                  >
                    <Send className="h-4 w-4" aria-hidden />
                    <span>{sending ? 'Processing…' : 'Send'}</span>
                  </Button>
                </div>
              </form>
            </Card>
          </div>

          {/* Right column: Decision Rail */}
          <div className="xl:col-span-2">
            {latest ? (
              <DecisionPanels data={latest} />
            ) : (
              <Card>
                <CardBody className="py-12 text-center text-sm text-slate-400 space-y-2">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800/60 text-slate-500">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div className="font-semibold text-slate-300">Awaiting Interaction</div>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    The policy engine verdict, allowed entitlements, rejected claims, and simulated actions will appear here in real-time.
                  </p>
                </CardBody>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

