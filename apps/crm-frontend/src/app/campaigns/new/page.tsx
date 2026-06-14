'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

interface SegmentRule {
  field: string;
  operator: string;
  value: string | number | string[];
}

interface Customer {
  id: string;
  name: string;
  email: string;
  city: string;
  order_count: number;
  total_spend: number;
}

type Step = 'segment' | 'message' | 'review';

const FIELD_LABELS: Record<string, string> = {
  total_spend: 'Total Spend (₹)',
  order_count: 'Order Count',
  days_since_last_order: 'Days Since Last Order',
  city: 'City',
};

const OP_LABELS: Record<string, string> = {
  gt: '>', lt: '<', eq: '=', gte: '≥', lte: '≤', neq: '≠', in: 'in',
};

const CHANNELS = [
  { value: 'email', label: 'Email', emoji: '📧' },
  { value: 'sms', label: 'SMS', emoji: '💬' },
  { value: 'whatsapp', label: 'WhatsApp', emoji: '💚' },
  { value: 'rcs', label: 'RCS', emoji: '📱' },
];

export default function NewCampaignPage() {
  const router = useRouter();

  // Stepper
  const [step, setStep] = useState<Step>('segment');

  // Segment
  const [nlQuery, setNlQuery] = useState('');
  const [rules, setRules] = useState<SegmentRule[]>([]);
  const [matchedCount, setMatchedCount] = useState<number | null>(null);
  const [sampleCustomers, setSampleCustomers] = useState<Customer[]>([]);
  const [parsingSegment, setParsingSegment] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Message
  const [channel, setChannel] = useState('email');
  const [messageVariants, setMessageVariants] = useState<string[]>([]);
  const [selectedMessage, setSelectedMessage] = useState('');
  const [generatingMessage, setGeneratingMessage] = useState(false);

  // Campaign
  const [campaignName, setCampaignName] = useState('');
  const [sending, setSending] = useState(false);

  // Errors
  const [error, setError] = useState('');

  // ── Step 1: Parse NL → Rules ──
  async function handleParseSegment() {
    if (!nlQuery.trim()) return;
    setError('');
    setParsingSegment(true);

    try {
      const data = await apiFetch<{ rules: SegmentRule[] }>('/ai/parse-segment', {
        method: 'POST',
        body: JSON.stringify({ query: nlQuery }),
      });

      setRules(data.rules);
      // Auto-preview
      await previewSegment(data.rules);
    } catch (err: any) {
      setError(err.message || 'Failed to parse segment');
    } finally {
      setParsingSegment(false);
    }
  }

  async function previewSegment(rulesToPreview: SegmentRule[] = rules) {
    setPreviewLoading(true);
    try {
      const data = await apiFetch<{ count: number; sample: Customer[] }>('/segments/preview', {
        method: 'POST',
        body: JSON.stringify({ rules: rulesToPreview }),
      });
      setMatchedCount(data.count);
      setSampleCustomers(data.sample);
    } catch (err: any) {
      setError(err.message || 'Failed to preview segment');
    } finally {
      setPreviewLoading(false);
    }
  }

  // ── Step 2: Generate Messages ──
  async function handleGenerateMessages() {
    setError('');
    setGeneratingMessage(true);

    try {
      const data = await apiFetch<{ messages: string[] }>('/ai/generate-message', {
        method: 'POST',
        body: JSON.stringify({
          segmentDescription: nlQuery,
          channel,
          brandName: 'Xeno Store',
        }),
      });

      setMessageVariants(data.messages);
      if (data.messages.length > 0) {
        setSelectedMessage(data.messages[0]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate messages');
    } finally {
      setGeneratingMessage(false);
    }
  }

  // ── Step 3: Create & Send Campaign ──
  async function handleSendCampaign() {
    if (!campaignName.trim() || !selectedMessage.trim()) return;
    setError('');
    setSending(true);

    try {
      // 1. Create campaign
      const campaign = await apiFetch<{ id: string }>('/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          name: campaignName,
          channel,
          message_body: selectedMessage,
        }),
      });

      // 2. Create segment
      await apiFetch('/segments', {
        method: 'POST',
        body: JSON.stringify({
          campaign_id: campaign.id,
          name: nlQuery,
          rules,
        }),
      });

      // 3. Send
      await apiFetch(`/campaigns/${campaign.id}/send`, {
        method: 'POST',
      });

      // Navigate to campaign detail for live stats
      router.push(`/campaigns/${campaign.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to send campaign');
      setSending(false);
    }
  }

  const steps = [
    { key: 'segment', label: 'Audience', icon: '🎯' },
    { key: 'message', label: 'Message', icon: '✍️' },
    { key: 'review', label: 'Review & Send', icon: '🚀' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="text-3xl font-bold gradient-text inline-block">New Campaign</h1>
        <p className="text-[var(--color-text-secondary)] mt-2">
          Describe your audience in plain English — AI handles the rest
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 animate-fade-in-delay-1">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2 flex-1">
            <button
              onClick={() => {
                // Only allow going back
                const stepOrder: Step[] = ['segment', 'message', 'review'];
                if (stepOrder.indexOf(s.key as Step) <= stepOrder.indexOf(step)) {
                  setStep(s.key as Step);
                }
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all w-full justify-center ${
                step === s.key
                  ? 'text-white'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
              }`}
              style={step === s.key ? { background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-glow)' } : { background: 'var(--color-bg-card)' }}
            >
              <span>{s.icon}</span>
              <span>{s.label}</span>
            </button>
            {i < steps.length - 1 && (
              <div className="w-8 h-px bg-[var(--color-border)] shrink-0" />
            )}
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-xl bg-[var(--color-danger-dim)] border border-[var(--color-danger)] text-[var(--color-danger)] text-sm">
          {error}
        </div>
      )}

      {/* ═══ STEP 1: SEGMENT ═══ */}
      {step === 'segment' && (
        <div className="space-y-6 animate-fade-in">
          {/* NL Input */}
          <div className="glass rounded-2xl p-6">
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-3">
              Describe your target audience
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                value={nlQuery}
                onChange={(e) => setNlQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleParseSegment()}
                placeholder={'e.g. "high spenders who haven\'t ordered in 45 days" or "customers in Mumbai who ordered twice"'}
                className="flex-1 px-5 py-4 rounded-xl bg-[var(--color-bg-input)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] transition-colors text-sm"
              />
              <button
                onClick={handleParseSegment}
                disabled={parsingSegment || !nlQuery.trim()}
                className="px-6 py-4 rounded-xl text-white font-medium transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                style={{ background: 'var(--gradient-primary)' }}
              >
                {parsingSegment ? <div className="spinner" style={{ width: 18, height: 18 }} /> : '🤖'}
                <span>{parsingSegment ? 'Parsing...' : 'Parse with AI'}</span>
              </button>
            </div>
          </div>

          {/* Parsed Rules */}
          {rules.length > 0 && (
            <div className="glass rounded-2xl p-6 animate-fade-in">
              <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">
                AI-Parsed Segment Rules
              </h3>
              <div className="flex flex-wrap gap-2">
                {rules.map((rule, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm"
                    style={{ background: 'var(--color-accent-glow)', border: '1px solid var(--color-accent)' }}
                  >
                    <span className="text-[var(--color-accent-light)] font-medium">
                      {FIELD_LABELS[rule.field] || rule.field}
                    </span>
                    <span className="text-[var(--color-text-muted)]">{OP_LABELS[rule.operator] || rule.operator}</span>
                    <span className="text-[var(--color-text-primary)] font-semibold">
                      {Array.isArray(rule.value) ? rule.value.join(', ') : String(rule.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Match Count */}
          {matchedCount !== null && (
            <div className="glass rounded-2xl p-6 animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                    <span className="text-3xl font-bold text-[var(--color-success)]">{matchedCount}</span>
                    <span className="ml-2 text-sm text-[var(--color-text-secondary)]">customers matched</span>
                  </h3>
                </div>
                <button
                  onClick={() => previewSegment()}
                  disabled={previewLoading}
                  className="text-sm text-[var(--color-accent-light)] hover:text-[var(--color-accent)] transition-colors"
                >
                  {previewLoading ? 'Refreshing...' : '🔄 Refresh'}
                </button>
              </div>

              {/* Sample customers */}
              {sampleCustomers.length > 0 && (
                <div>
                  <p className="text-xs text-[var(--color-text-muted)] mb-2">Sample customers:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {sampleCustomers.slice(0, 6).map((c) => (
                      <div key={c.id} className="flex items-center gap-2 p-2 rounded-lg bg-[var(--color-bg-input)]">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ background: 'var(--gradient-primary)' }}>
                          {c.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-[var(--color-text-primary)] truncate">{c.name}</p>
                          <p className="text-[10px] text-[var(--color-text-muted)]">{c.city} · ₹{Math.round(c.total_spend)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Next */}
          {matchedCount !== null && matchedCount > 0 && (
            <div className="flex justify-end">
              <button
                onClick={() => setStep('message')}
                className="px-8 py-3 rounded-xl text-white font-medium transition-all duration-200 hover:scale-105"
                style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-glow)' }}
              >
                Next: Compose Message →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ═══ STEP 2: MESSAGE ═══ */}
      {step === 'message' && (
        <div className="space-y-6 animate-fade-in">
          {/* Channel Selector */}
          <div className="glass rounded-2xl p-6">
            <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">Channel</h3>
            <div className="flex gap-3">
              {CHANNELS.map((ch) => (
                <button
                  key={ch.value}
                  onClick={() => setChannel(ch.value)}
                  className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                    channel === ch.value
                      ? 'text-white'
                      : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                  }`}
                  style={channel === ch.value
                    ? { background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-glow)' }
                    : { background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }
                  }
                >
                  <span>{ch.emoji}</span>
                  <span>{ch.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Generate */}
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-[var(--color-text-secondary)]">
                AI Message Composer
              </h3>
              <button
                onClick={handleGenerateMessages}
                disabled={generatingMessage}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-white text-sm font-medium transition-all hover:scale-105 disabled:opacity-50"
                style={{ background: 'var(--gradient-primary)' }}
              >
                {generatingMessage ? <div className="spinner" style={{ width: 16, height: 16 }} /> : '✨'}
                <span>{generatingMessage ? 'Generating...' : 'Generate Variants'}</span>
              </button>
            </div>

            {/* Variants */}
            {messageVariants.length > 0 && (
              <div className="space-y-3 mb-6">
                <p className="text-xs text-[var(--color-text-muted)]">Select a variant:</p>
                {messageVariants.map((msg, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedMessage(msg)}
                    className={`w-full text-left p-4 rounded-xl text-sm transition-all duration-200 ${
                      selectedMessage === msg
                        ? 'ring-2 ring-[var(--color-accent)] bg-[var(--color-accent-glow)]'
                        : 'bg-[var(--color-bg-input)] hover:bg-[var(--color-bg-card-hover)] border border-[var(--color-border)]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                        selectedMessage === msg ? 'bg-[var(--color-accent)] text-white' : 'bg-[var(--color-border)] text-[var(--color-text-muted)]'
                      }`}>
                        {i + 1}
                      </span>
                      <p className="text-[var(--color-text-primary)] leading-relaxed">{msg}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Editable textarea */}
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-2">
                Edit your message (use {'{name}'} for personalization):
              </label>
              <textarea
                value={selectedMessage}
                onChange={(e) => setSelectedMessage(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 rounded-xl bg-[var(--color-bg-input)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] transition-colors text-sm resize-none"
                placeholder="Type your message here or generate one with AI above..."
              />
            </div>
          </div>

          {/* Navigation */}
          <div className="flex justify-between">
            <button
              onClick={() => setStep('segment')}
              className="px-6 py-3 rounded-xl text-[var(--color-text-secondary)] font-medium border border-[var(--color-border)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-accent)] transition-colors"
            >
              ← Back to Audience
            </button>
            <button
              onClick={() => setStep('review')}
              disabled={!selectedMessage.trim()}
              className="px-8 py-3 rounded-xl text-white font-medium transition-all duration-200 hover:scale-105 disabled:opacity-50"
              style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-glow)' }}
            >
              Next: Review & Send →
            </button>
          </div>
        </div>
      )}

      {/* ═══ STEP 3: REVIEW & SEND ═══ */}
      {step === 'review' && (
        <div className="space-y-6 animate-fade-in">
          {/* Campaign Name */}
          <div className="glass rounded-2xl p-6">
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-3">
              Campaign Name
            </label>
            <input
              type="text"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="e.g. Win-back: High spenders Q4"
              className="w-full px-5 py-4 rounded-xl bg-[var(--color-bg-input)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
            />
          </div>

          {/* Summary */}
          <div className="glass rounded-2xl p-6">
            <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-4">Campaign Summary</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-[var(--color-bg-input)]">
                <p className="text-xs text-[var(--color-text-muted)] mb-1">Audience</p>
                <p className="text-sm text-[var(--color-text-primary)]">{nlQuery}</p>
                <p className="text-lg font-bold text-[var(--color-success)] mt-1">{matchedCount} customers</p>
              </div>

              <div className="p-4 rounded-xl bg-[var(--color-bg-input)]">
                <p className="text-xs text-[var(--color-text-muted)] mb-1">Channel</p>
                <p className="text-sm text-[var(--color-text-primary)]">
                  {CHANNELS.find(c => c.value === channel)?.emoji} {CHANNELS.find(c => c.value === channel)?.label}
                </p>
              </div>

              <div className="col-span-2 p-4 rounded-xl bg-[var(--color-bg-input)]">
                <p className="text-xs text-[var(--color-text-muted)] mb-1">Message</p>
                <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap">{selectedMessage}</p>
              </div>

              <div className="col-span-2 p-4 rounded-xl bg-[var(--color-bg-input)]">
                <p className="text-xs text-[var(--color-text-muted)] mb-1">Rules</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {rules.map((rule, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs"
                      style={{ background: 'var(--color-accent-glow)', color: 'var(--color-accent-light)' }}
                    >
                      {FIELD_LABELS[rule.field]} {OP_LABELS[rule.operator]} {Array.isArray(rule.value) ? rule.value.join(', ') : String(rule.value)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between">
            <button
              onClick={() => setStep('message')}
              className="px-6 py-3 rounded-xl text-[var(--color-text-secondary)] font-medium border border-[var(--color-border)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-accent)] transition-colors"
            >
              ← Back to Message
            </button>
            <button
              onClick={handleSendCampaign}
              disabled={sending || !campaignName.trim() || !selectedMessage.trim()}
              className="px-8 py-4 rounded-xl text-white font-bold text-lg transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed animate-pulse-glow flex items-center gap-3"
              style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-glow)' }}
            >
              {sending ? (
                <>
                  <div className="spinner" style={{ width: 20, height: 20, borderTopColor: 'white' }} />
                  Sending...
                </>
              ) : (
                <>🚀 Launch Campaign</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
