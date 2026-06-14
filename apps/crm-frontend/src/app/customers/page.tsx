'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  created_at: string;
  order_count: number;
  total_spend: number;
  last_order_at: string | null;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ total: 0, limit: 20, offset: 0, hasMore: false });

  const loadCustomers = useCallback(async (offset = 0, searchQuery = search) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '20', offset: String(offset) });
      if (searchQuery) params.set('search', searchQuery);

      const data = await apiFetch<{ data: Customer[]; pagination: typeof pagination }>(
        `/customers?${params}`
      );

      setCustomers(data.data);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadCustomers(0);
  }, []);

  const handleSearch = () => {
    loadCustomers(0, search);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const daysSince = (dateStr: string | null) => {
    if (!dateStr) return null;
    const diff = Date.now() - new Date(dateStr).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="text-3xl font-bold gradient-text inline-block">Customers</h1>
        <p className="text-[var(--color-text-secondary)] mt-2">
          {pagination.total} customers in your database
        </p>
      </div>

      {/* Search Bar */}
      <div className="flex gap-3 animate-fade-in-delay-1">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Search by name, email, or city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full px-5 py-3 rounded-xl bg-[var(--color-bg-input)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">🔍</span>
        </div>
        <button
          onClick={handleSearch}
          className="px-6 py-3 rounded-xl text-white font-medium transition-all duration-200 hover:scale-105"
          style={{ background: 'var(--gradient-primary)' }}
        >
          Search
        </button>
      </div>

      {/* Table */}
      <div className="glass rounded-2xl overflow-hidden animate-fade-in-delay-2">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="text-left px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Customer</th>
                <th className="text-left px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">City</th>
                <th className="text-right px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Orders</th>
                <th className="text-right px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Total Spend</th>
                <th className="text-right px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Last Order</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <div className="spinner mx-auto" />
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center text-[var(--color-text-muted)]">
                    No customers found
                  </td>
                </tr>
              ) : (
                customers.map((customer) => {
                  const days = daysSince(customer.last_order_at);
                  const recencyColor = days === null
                    ? 'var(--color-text-muted)'
                    : days < 14
                    ? 'var(--color-success)'
                    : days < 30
                    ? 'var(--color-warning)'
                    : 'var(--color-danger)';

                  return (
                    <tr
                      key={customer.id}
                      className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-card-hover)] transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                            style={{ background: 'var(--gradient-primary)' }}
                          >
                            {customer.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                          <div>
                            <p className="font-medium text-[var(--color-text-primary)]">{customer.name}</p>
                            <p className="text-xs text-[var(--color-text-muted)]">{customer.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-[var(--color-text-secondary)]">{customer.city || '—'}</td>
                      <td className="px-6 py-4 text-sm text-right font-medium text-[var(--color-text-primary)]">{customer.order_count}</td>
                      <td className="px-6 py-4 text-sm text-right font-medium text-[var(--color-success)]">{formatCurrency(customer.total_spend)}</td>
                      <td className="px-6 py-4 text-sm text-right">
                        <span style={{ color: recencyColor }}>
                          {formatDate(customer.last_order_at)}
                        </span>
                        {days !== null && (
                          <span className="block text-xs" style={{ color: recencyColor }}>
                            {days === 0 ? 'Today' : `${days}d ago`}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && pagination.total > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--color-border)]">
            <p className="text-sm text-[var(--color-text-muted)]">
              Showing {pagination.offset + 1}–{Math.min(pagination.offset + pagination.limit, pagination.total)} of {pagination.total}
            </p>
            <div className="flex gap-2">
              <button
                disabled={pagination.offset === 0}
                onClick={() => loadCustomers(pagination.offset - pagination.limit)}
                className="px-4 py-2 rounded-lg text-sm border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-accent)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ← Previous
              </button>
              <button
                disabled={!pagination.hasMore}
                onClick={() => loadCustomers(pagination.offset + pagination.limit)}
                className="px-4 py-2 rounded-lg text-sm border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-accent)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
