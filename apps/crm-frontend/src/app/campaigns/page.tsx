'use client';

import { useEffect, useState } from 'react';
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
  audience_size: number;
  total_recipients: number;
  sent_count: number;
  delivered_count: number;
  opened_count: number;
  clicked_count: number;
  failed_count: number;
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ data: Campaign[] }>('/campaigns')
      .then(data => setCampaigns(data.data))
      .catch(err => console.error('Failed to load campaigns:', err))
      .finally(() => setLoading(false));
  }, []);

  const channelConfig: Record<string, { emoji: string; label: string; color: string }> = {
    email: { emoji: '📧', label: 'Email', color: 'var(--color-info)' },
    sms: { emoji: '💬', label: 'SMS', color: 'var(--color-success)' },
    whatsapp: { emoji: '💚', label: 'WhatsApp', color: '#25D366' },
    rcs: { emoji: '📱', label: 'RCS', color: 'var(--color-accent)' },
  };

  const statusConfig: Record<string, { color: string; bg: string }> = {
    draft: { color: 'var(--color-text-muted)', bg: 'rgba(96, 96, 122, 0.15)' },
    sending: { color: 'var(--color-warning)', bg: 'var(--color-warning-dim)' },
    sent: { color: 'var(--color-success)', bg: 'var(--color-success-dim)' },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="spinner" style={{ width: 40, height: 40 }} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold gradient-text inline-block">Campaigns</h1>
          <p className="text-[var(--color-text-secondary)] mt-2">
            {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''} created
          </p>
        </div>
        <Link
          href="/campaigns/new"
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-medium transition-all duration-300 hover:scale-105"
          style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-glow)' }}
        >
          ✨ New Campaign
        </Link>
      </div>

      {/* Campaign Grid */}
      {campaigns.length === 0 ? (
        <div className="glass rounded-2xl p-16 text-center animate-fade-in-delay-1">
          <p className="text-5xl mb-4">🎯</p>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">No campaigns yet</h2>
          <p className="text-[var(--color-text-muted)] mb-6">
            Create your first AI-powered campaign to start engaging customers
          </p>
          <Link
            href="/campaigns/new"
            className="inline-block px-8 py-3 rounded-xl text-white font-medium"
            style={{ background: 'var(--gradient-primary)' }}
          >
            Create Your First Campaign
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {campaigns.map((campaign, i) => {
            const ch = channelConfig[campaign.channel] || channelConfig.email;
            const st = statusConfig[campaign.status] || statusConfig.draft;
            const total = campaign.total_recipients || 1;
            const deliveredPct = Math.round((campaign.delivered_count / total) * 100);
            const openedPct = Math.round((campaign.opened_count / total) * 100);
            const clickedPct = Math.round((campaign.clicked_count / total) * 100);
            const failedPct = Math.round((campaign.failed_count / total) * 100);

            return (
              <Link
                key={campaign.id}
                href={`/campaigns/${campaign.id}`}
                className="glass rounded-2xl p-6 hover:bg-[var(--color-bg-card-hover)] transition-all duration-200 group animate-fade-in"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                {/* Top */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                      style={{ background: `${ch.color}22` }}
                    >
                      {ch.emoji}
                    </div>
                    <div>
                      <h3 className="font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-accent-light)] transition-colors">
                        {campaign.name}
                      </h3>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {ch.label} · {new Date(campaign.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span
                    className="text-xs font-medium px-3 py-1 rounded-full capitalize"
                    style={{ color: st.color, background: st.bg }}
                  >
                    {campaign.status}
                  </span>
                </div>

                {/* Message preview */}
                <p className="text-sm text-[var(--color-text-secondary)] mb-4 line-clamp-2">
                  {campaign.message_body || 'No message set'}
                </p>

                {/* Stats */}
                {campaign.total_recipients > 0 ? (
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { label: 'Sent', value: campaign.sent_count, color: 'var(--color-text-primary)' },
                      { label: 'Delivered', value: `${deliveredPct}%`, color: 'var(--color-success)' },
                      { label: 'Opened', value: `${openedPct}%`, color: 'var(--color-info)' },
                      { label: 'Clicked', value: `${clickedPct}%`, color: 'var(--color-accent-light)' },
                    ].map(stat => (
                      <div key={stat.label} className="text-center">
                        <p className="text-lg font-bold" style={{ color: stat.color }}>{stat.value}</p>
                        <p className="text-xs text-[var(--color-text-muted)]">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {campaign.audience_size > 0 ? `${campaign.audience_size} customers in segment` : 'No audience set'}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
