'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

interface Campaign {
  id: string;
  name: string;
  channel: string;
  status: string;
  created_at: string;
  audience_size: number;
  total_recipients: number;
  sent_count: number;
  delivered_count: number;
  opened_count: number;
  clicked_count: number;
  failed_count: number;
}

interface DashboardStats {
  totalCampaigns: number;
  totalCustomers: number;
  activeCampaigns: number;
  avgDeliveryRate: number;
}

export default function DashboardPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalCampaigns: 0, totalCustomers: 0, activeCampaigns: 0, avgDeliveryRate: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [campaignData, customerData] = await Promise.all([
          apiFetch<{ data: Campaign[] }>('/campaigns'),
          apiFetch<{ pagination: { total: number } }>('/customers?limit=1'),
        ]);

        setCampaigns(campaignData.data);

        const sent = campaignData.data.filter(c => c.status === 'sent' || c.status === 'sending');
        const totalDelivered = campaignData.data.reduce((sum, c) => sum + c.delivered_count, 0);
        const totalRecipients = campaignData.data.reduce((sum, c) => sum + c.total_recipients, 0);

        setStats({
          totalCampaigns: campaignData.data.length,
          totalCustomers: customerData.pagination.total,
          activeCampaigns: sent.length,
          avgDeliveryRate: totalRecipients > 0 ? Math.round((totalDelivered / totalRecipients) * 100) : 0,
        });
      } catch (err) {
        console.error('Failed to load dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const statCards = [
    { label: 'Total Campaigns', value: stats.totalCampaigns, icon: '📬', color: 'var(--color-accent)' },
    { label: 'Customers', value: stats.totalCustomers, icon: '👥', color: 'var(--color-success)' },
    { label: 'Active Sends', value: stats.activeCampaigns, icon: '🚀', color: 'var(--color-warning)' },
    { label: 'Avg Delivery %', value: `${stats.avgDeliveryRate}%`, icon: '📈', color: 'var(--color-info)' },
  ];

  const channelEmoji: Record<string, string> = {
    email: '📧', sms: '💬', whatsapp: '💚', rcs: '📱',
  };

  const statusColor: Record<string, string> = {
    draft: 'var(--color-text-muted)',
    sending: 'var(--color-warning)',
    sent: 'var(--color-success)',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="spinner" style={{ width: 40, height: 40 }} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="text-3xl font-bold gradient-text inline-block">Dashboard</h1>
        <p className="text-[var(--color-text-secondary)] mt-2">
          Overview of your campaigns and customer engagement
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, i) => (
          <div
            key={card.label}
            className={`glass rounded-2xl p-6 hover:scale-[1.02] transition-all duration-300 animate-fade-in-delay-${Math.min(i + 1, 3)}`}
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-2xl">{card.icon}</span>
              <div className="w-2 h-2 rounded-full" style={{ background: card.color }} />
            </div>
            <p className="text-3xl font-bold text-[var(--color-text-primary)]">{card.value}</p>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="flex gap-4 animate-fade-in-delay-2">
        <Link
          href="/campaigns/new"
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-medium transition-all duration-300 hover:scale-105 hover:shadow-xl"
          style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-glow)' }}
        >
          <span>✨</span> New AI Campaign
        </Link>
        <Link
          href="/customers"
          className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-200 border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-accent)]"
        >
          <span>👥</span> View Customers
        </Link>
      </div>

      {/* Recent Campaigns */}
      <div className="animate-fade-in-delay-3">
        <h2 className="text-xl font-semibold mb-4 text-[var(--color-text-primary)]">Recent Campaigns</h2>

        {campaigns.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center">
            <p className="text-4xl mb-4">🎯</p>
            <p className="text-lg text-[var(--color-text-secondary)]">No campaigns yet</p>
            <p className="text-sm text-[var(--color-text-muted)] mt-2">
              Create your first AI-powered campaign to get started
            </p>
            <Link
              href="/campaigns/new"
              className="inline-block mt-6 px-6 py-3 rounded-xl text-white font-medium"
              style={{ background: 'var(--gradient-primary)' }}
            >
              Create Campaign
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {campaigns.slice(0, 5).map((campaign) => {
              const total = campaign.total_recipients || 1;
              const deliveredPct = Math.round((campaign.delivered_count / total) * 100);
              const openedPct = Math.round((campaign.opened_count / total) * 100);
              const clickedPct = Math.round((campaign.clicked_count / total) * 100);

              return (
                <Link
                  key={campaign.id}
                  href={`/campaigns/${campaign.id}`}
                  className="block glass rounded-2xl p-6 hover:bg-[var(--color-bg-card-hover)] transition-all duration-200 group"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{channelEmoji[campaign.channel] || '📧'}</span>
                      <div>
                        <h3 className="font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-accent-light)] transition-colors">
                          {campaign.name}
                        </h3>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {new Date(campaign.created_at).toLocaleDateString()} · {campaign.total_recipients} recipients
                        </p>
                      </div>
                    </div>
                    <span
                      className="text-xs font-medium px-3 py-1 rounded-full"
                      style={{
                        color: statusColor[campaign.status],
                        background: `${statusColor[campaign.status]}22`,
                      }}
                    >
                      {campaign.status}
                    </span>
                  </div>

                  {campaign.total_recipients > 0 && (
                    <div className="flex gap-6 text-xs">
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="text-[var(--color-text-muted)]">Delivered</span>
                          <span className="text-[var(--color-success)]">{deliveredPct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[var(--color-bg-input)]">
                          <div className="h-full rounded-full stat-bar" style={{ width: `${deliveredPct}%`, background: 'var(--color-success)' }} />
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="text-[var(--color-text-muted)]">Opened</span>
                          <span className="text-[var(--color-info)]">{openedPct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[var(--color-bg-input)]">
                          <div className="h-full rounded-full stat-bar" style={{ width: `${openedPct}%`, background: 'var(--color-info)' }} />
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="text-[var(--color-text-muted)]">Clicked</span>
                          <span className="text-[var(--color-accent-light)]">{clickedPct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[var(--color-bg-input)]">
                          <div className="h-full rounded-full stat-bar" style={{ width: `${clickedPct}%`, background: 'var(--color-accent)' }} />
                        </div>
                      </div>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
