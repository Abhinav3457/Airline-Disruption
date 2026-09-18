import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Send } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  decisionTone,
} from '@/components';
import { useToasts } from '@/hooks';
import { getCustomerByPnr, postAgentChat } from '@/services';
import type { ChatData, Customer } from '@/types';
import { humanizeIntent } from '@/utils';

interface ChatMessage {
  id: number;
  role: 'user' | 'agent';
  text: string;
}

/** One executed (or refused) action row. */
function ActionRow({ action }: { action: ChatData['actions'][number] }) {
  const completed = action.status === 'completed';
  return (
    <li className="flex items-start justify-between gap-3 rounded-md border border-ops-line bg-ops-800/50 px-3 py-2 text-sm">
      <div>
        <span className="font-mono text-xs text-ops-accent">
          {action.action}
        </span>
        <div className="text-xs text-ops-muted">{action.reason}</div>
      </div>
      <Badge tone={completed ? 'ok' : 'bad'}>{action.status}</Badge>
    </li>
  );
}

/** Right-hand verdict panel for the latest agent turn. */
function DecisionPanels({ data }: { data: ChatData }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Policy decision"
          meta={
            <Badge tone={decisionTone(data.decision.status)}>
              {data.decision.status.replace('_', ' ')}
            </Badge>
          }
        />
        <CardBody className="space-y-3 text-sm text-ops-muted">
          <p>{data.decision.explanation}</p>
          {data.decision.eligibleActions.length > 0 ? (
            <div>
              <div className="text-xs tracking-wide text-ops-text uppercase">
                Eligible actions
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {data.decision.eligibleActions.map((actionId) => (
                  <Badge key={actionId} tone="ok">
                    {actionId}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
          {data.decision.ineligibleActions.length > 0 ? (
            <div>
              <div className="text-xs tracking-wide text-ops-text uppercase">
                Not permitted
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {data.decision.ineligibleActions.map((actionId) => (
                  <Badge key={actionId} tone="bad">
                    {actionId}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
          <div>
            <div className="text-xs tracking-wide text-ops-text uppercase">
              Policy sources
            </div>
            <ul className="mt-1 space-y-0.5 text-xs">
              {data.policyUsed.map((source) => (
                <li key={source}>· {source}</li>
              ))}
            </ul>
          </div>
          <div className="text-xs text-ops-faint">
            Intent: {humanizeIntent(data.intent)} ·{' '}
            {data.llmUsed ? 'Groq LLM phrasing' : 'deterministic fallback'}
          </div>
        </CardBody>
      </Card>

      {data.actions.length > 0 ? (
        <Card>
          <CardHeader title="Executed actions" meta={`${data.actions.length}`} />
          <CardBody>
            <ul className="space-y-2">
              {data.actions.map((action) => (
                <ActionRow key={action.id} action={action} />
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      {data.escalation ? (
        <Card className="border-purple-500/30">
          <CardHeader
            title="Escalation"
            meta={<Badge tone="escalate">{data.escalation.priority} priority</Badge>}
          />
          <CardBody className="text-sm text-ops-muted">
            <p>{data.escalation.reason}</p>
            <p className="mt-1 text-xs text-ops-faint">
              Status: {data.escalation.status} · trigger{' '}
              <code className="text-purple-400">{data.escalation.trigger}</code>
            </p>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}

export function ChatPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const pnrFromUrl = searchParams.get('pnr') ?? '';

  const [pnr, setPnr] = useState(pnrFromUrl);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [latest, setLatest] = useState<ChatData | null>(null);
  const [previewCustomer, setPreviewCustomer] = useState<Customer | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const { pushToast } = useToasts();

  // Load profile preview when the PNR changes (best-effort; optional).
  useEffect(() => {
    setPreviewCustomer(null);
    const trimmed = pnr.trim();
    if (!/^[A-Za-z0-9]{5,8}$/.test(trimmed)) return;
    let cancelled = false;
    getCustomerByPnr(trimmed)
      .then((profile) => {
        if (!cancelled) setPreviewCustomer(profile);
      })
      .catch(() => {
        if (!cancelled) setPreviewCustomer(null);
      });
    return () => {
      cancelled = true;
    };
  }, [pnr]);

  // Keep the newest message visible.
  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [messages]);

  // Sync ?pnr= URL param into the input once.
  useEffect(() => {
    if (pnrFromUrl) setPnr(pnrFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pnrFromUrl]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmedPnr = pnr.trim();
    const trimmedMessage = input.trim();

    if (!/^[A-Za-z0-9]{5,8}$/.test(trimmedPnr)) {
      pushToast('error', 'PNR must be 5-8 letters/digits.');
      return;
    }
    if (!trimmedMessage) {
      pushToast('error', 'Please type a message for the agent.');
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
      setSearchParams({ pnr: trimmedPnr }, { replace: true });
    } catch (error) {
      const messageText =
        error instanceof Error ? error.message : 'The agent could not be reached.';
      pushToast('error', messageText);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Agent Chat</h1>
        <p className="mt-1 text-sm text-ops-muted">
          Talk to the resolution agent. The backend's policy engine decides
          everything — the LLM only phrases the outcome.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        {/* Conversation column */}
        <div className="space-y-4 xl:col-span-3">
          <Card>
            <CardHeader
              title="Conversation"
              meta={
                previewCustomer ? (
                  <span className="flex items-center gap-2">
                    {previewCustomer.name}
                    <Badge
                      tone={
                        previewCustomer.loyaltyTier === 'Platinum'
                          ? 'escalate'
                          : previewCustomer.loyaltyTier === 'Gold'
                            ? 'warn'
                            : 'neutral'
                      }
                    >
                      {previewCustomer.loyaltyTier}
                    </Badge>
                  </span>
                ) : (
                  'try: TR1190B'
                )
              }
            />
            <div
              ref={threadRef}
              className="h-96 space-y-3 overflow-y-auto px-4 py-3"
            >
              {messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center text-sm text-ops-faint">
                  <p>No messages yet.</p>
                  <p className="mt-1">
                    e.g. “My flight is delayed 6 hours. Give me a full-night
                    hotel and waive the ₹2000 fare difference.”
                  </p>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
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
              <div className="mb-2 flex items-center gap-2">
                <label
                  htmlFor="pnr"
                  className="text-xs tracking-wide text-ops-muted uppercase"
                >
                  PNR
                </label>
                <input
                  id="pnr"
                  value={pnr}
                  onChange={(event) => setPnr(event.target.value.toUpperCase())}
                  placeholder="e.g. WL7742"
                  className="w-32 rounded-md border border-ops-line bg-ops-800 px-2.5 py-1.5 font-mono text-sm text-ops-text placeholder:text-ops-faint focus:border-ops-accent focus:outline-none"
                />
                {previewCustomer ? (
                  <span className="text-xs text-ops-faint">
                    {previewCustomer.email}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Describe the issue…"
                  className="flex-1 rounded-md border border-ops-line bg-ops-800 px-3 py-2 text-sm text-ops-text placeholder:text-ops-faint focus:border-ops-accent focus:outline-none"
                />
                <Button type="submit" disabled={sending}>
                  <Send className="h-3.5 w-3.5" aria-hidden />
                  {sending ? 'Sending…' : 'Send'}
                </Button>
              </div>
            </form>
          </Card>
        </div>

        {/* Decision column */}
        <div className="xl:col-span-2">
          {latest ? (
            <DecisionPanels data={latest} />
          ) : (
            <Card>
              <CardBody className="text-sm text-ops-muted">
                Send a message to see the policy decision, executed actions, and
                any escalation here.
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
