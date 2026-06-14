'use client';

import { useEffect, useState, useCallback, use } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

interface Campaign {
  id: string;
  name: string;
  channel: string;
  status: string;
  message_body: string;
  created_at: string;
  sent_at: string | null;
}

interface Stats {
  campaign_id: string;
  total: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  failed: number;
  delivered_rate: number;
  open_rate: number;
  click_rate: number;
  fail_rate: number;
}

interface Recipient {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_city: string;
  status: string;
  message_body: string;
  sent_at: string | null;
}

const STATUS_CONFIG: Record<string, { color: string; bg: string }> = {
  queued: { color: 'var(--color-text-muted)', bg: 'rgba(96, 96, 122, 0.15)' },
  sent: { color: 'var(--color-info)', bg: 'var(--color-info-dim)' },
  delivered: { color: 'var(--color-success)', bg: 'var(--color-success-dim)' },
  opened: { color: 'var(--color-warning)', bg: 'var(--color-warning-dim)' },
  clicked: { color: 'var(--color-accent-light)', bg: 'var(--color-accent-glow)' },
  failed: { color: 'var(--color-danger)', bg: 'var(--color-danger-dim)' },
};

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPolling, setIsPolling] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [campaignData, statsData, recipientsData] = await Promise.all([
        apiFetch<Campaign>(`/campaigns/${id}`),
        apiFetch<Stats>(`/campaigns/${id}/stats`),
        apiFetch<{ data: Recipient[] }>(`/campaigns/${id}/recipients?limit=50`),
      ]);

      setCampaign(campaignData);
      setStats(statsData);
      setRecipients(recipientsData.data);

      // Auto-poll if campaign is sending
      if (campaignData.status === 'sending') {
        setIsPolling(true);
      } else {
        setIsPolling(false);
      }
    } catch (err) {
      console.error('Failed to load campaign:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Poll stats every 3 seconds while campaign is sending
  useEffect(() => {
    if (!isPolling) return;

    const interval = setInterval(async () => {
      try {
        const [statsData, campaignData, recipientsData] = await Promise.all([
          apiFetch<Stats>(`/campaigns/${id}/stats`),
          apiFetch<Campaign>(`/campaigns/${id}`),
          apiFetch<{ data: Recipient[] }>(`/campaigns/${id}/recipients?limit=50`),
        ]);
        setStats(statsData);
        setCampaign(campaignData);
        setRecipients(recipientsData.data);

        if (campaignData.status !== 'sending') {
          setIsPolling(false);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isPolling, id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="spinner" style={{ width: 40, height: 40 }} />
      </div>
    );
  }

  if (!campaign || !stats) {
    return (
      <div className="text-center py-20">
        <p className="text-[var(--color-text-muted)]">Campaign not found</p>
      </div>
    );
  }

  const channelEmoji: Record<string, React.ReactNode> = {
    email: '📧',
    sms: '💬',
    whatsapp: (
      <img src="/whatsapp-icon.svg" className="w-7 h-7 inline-block align-middle" alt="WhatsApp" />
    ),
  };

  const statCards = [
    { label: 'Total', value: stats.total, rate: null, color: 'var(--color-text-primary)', icon: '📊' },
    { label: 'Delivered', value: stats.delivered, rate: stats.delivered_rate, color: 'var(--color-success)', icon: '✅' },
    { label: 'Opened', value: stats.opened, rate: stats.open_rate, color: 'var(--color-info)', icon: '👁️' },
    { label: 'Clicked', value: stats.clicked, rate: stats.click_rate, color: 'var(--color-accent-light)', icon: '🖱️' },
    { label: 'Failed', value: stats.failed, rate: stats.fail_rate, color: 'var(--color-danger)', icon: '❌' },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between animate-fade-in">
        <div>
          <Link href="/campaigns" className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-accent-light)] transition-colors mb-2 inline-block">
            ← Back to Campaigns
          </Link>
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)] flex items-center gap-3">
            {channelEmoji[campaign.channel]} {campaign.name}
          </h1>
          <p className="text-[var(--color-text-secondary)] mt-1">
            Created {new Date(campaign.created_at).toLocaleString()} · {campaign.channel.toUpperCase()}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isPolling && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-warning-dim)] text-[var(--color-warning)] text-sm">
              <div className="w-2 h-2 rounded-full bg-[var(--color-warning)] animate-pulse" />
              Live updating
            </div>
          )}
          <span
            className="text-sm font-medium px-4 py-2 rounded-full capitalize"
            style={{
              color: STATUS_CONFIG[campaign.status]?.color || 'var(--color-text-muted)',
              background: STATUS_CONFIG[campaign.status]?.bg || 'rgba(96, 96, 122, 0.15)',
            }}
          >
            {campaign.status}
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 animate-fade-in-delay-1">
        {statCards.map((card) => (
          <div key={card.label} className="glass rounded-2xl p-5 text-center">
            <p className="text-2xl mb-2">{card.icon}</p>
            <p className="text-3xl font-bold" style={{ color: card.color }}>{card.value}</p>
            {card.rate !== null && (
              <p className="text-sm font-medium mt-1" style={{ color: card.color }}>{card.rate}%</p>
            )}
            <p className="text-xs text-[var(--color-text-muted)] mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Progress Bars */}
      <div className="glass rounded-2xl p-6 space-y-4 animate-fade-in-delay-2">
        <h3 className="text-sm font-medium text-[var(--color-text-secondary)]">Delivery Funnel</h3>

        {[
          { label: 'Delivered', value: stats.delivered, rate: stats.delivered_rate, color: 'var(--color-success)' },
          { label: 'Opened', value: stats.opened, rate: stats.open_rate, color: 'var(--color-info)' },
          { label: 'Clicked', value: stats.clicked, rate: stats.click_rate, color: 'var(--color-accent)' },
          { label: 'Failed', value: stats.failed, rate: stats.fail_rate, color: 'var(--color-danger)' },
        ].map((bar) => (
          <div key={bar.label}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-[var(--color-text-secondary)]">{bar.label}</span>
              <span style={{ color: bar.color }}>{bar.value} ({bar.rate}%)</span>
            </div>
            <div className="h-2 rounded-full bg-[var(--color-bg-input)]">
              <div
                className="h-full rounded-full stat-bar transition-all duration-500"
                style={{ width: `${bar.rate}%`, background: bar.color }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Message Preview */}
      <div className="glass rounded-2xl p-6 animate-fade-in-delay-3">
        <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">Message</h3>
        <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap leading-relaxed">
          {campaign.message_body}
        </p>
      </div>

      {/* Recipients Table */}
      <div className="glass rounded-2xl overflow-hidden animate-fade-in-delay-3">
        <div className="p-6 border-b border-[var(--color-border)]">
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)]">
            Recipients ({stats.total})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Customer</th>
                <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">City</th>
                <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Status</th>
                <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Sent At</th>
              </tr>
            </thead>
            <tbody>
              {recipients.map((r) => {
                const sc = STATUS_CONFIG[r.status] || STATUS_CONFIG.queued;
                return (
                  <tr key={r.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-card-hover)] transition-colors">
                    <td className="px-6 py-3">
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">{r.customer_name}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">{r.customer_email}</p>
                    </td>
                    <td className="px-6 py-3 text-sm text-[var(--color-text-secondary)]">{r.customer_city}</td>
                    <td className="px-6 py-3">
                      <span
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full capitalize"
                        style={{ color: sc.color, background: sc.bg }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: sc.color }} />
                        {r.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-xs text-[var(--color-text-muted)]">
                      {r.sent_at ? new Date(r.sent_at).toLocaleString() : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
