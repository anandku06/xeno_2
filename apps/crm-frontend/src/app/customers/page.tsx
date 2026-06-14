'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
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

type ModalTab = 'single' | 'bulk';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ total: 0, limit: 20, offset: 0, hasMore: false });

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalTab, setModalTab] = useState<ModalTab>('single');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Single customer form
  const [form, setForm] = useState({ name: '', email: '', phone: '', city: '' });

  // Bulk import
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const openModal = () => {
    setShowModal(true);
    setFormError('');
    setFormSuccess('');
    setForm({ name: '', email: '', phone: '', city: '' });
    setBulkFile(null);
    setModalTab('single');
  };

  const closeModal = () => {
    setShowModal(false);
    setFormError('');
    setFormSuccess('');
  };

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!form.name.trim() || !form.email.trim()) {
      setFormError('Name and email are required.');
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch('/customers', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setFormSuccess('Customer added successfully!');
      setForm({ name: '', email: '', phone: '', city: '' });
      loadCustomers(0);
      setTimeout(() => closeModal(), 1200);
    } catch (err: any) {
      setFormError(err.message || 'Failed to add customer.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkSubmit = async () => {
    if (!bulkFile) {
      setFormError('Please select a CSV file.');
      return;
    }

    setFormError('');
    setFormSuccess('');
    setSubmitting(true);

    try {
      const text = await bulkFile.text();
      const lines = text.split('\n').filter((l) => l.trim());

      if (lines.length < 2) {
        setFormError('CSV must have a header row and at least one data row.');
        setSubmitting(false);
        return;
      }

      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
      const nameIdx = headers.indexOf('name');
      const emailIdx = headers.indexOf('email');
      const phoneIdx = headers.indexOf('phone');
      const cityIdx = headers.indexOf('city');

      if (nameIdx === -1 || emailIdx === -1) {
        setFormError('CSV must have "name" and "email" columns.');
        setSubmitting(false);
        return;
      }

      const customers = lines.slice(1).map((line) => {
        const cols = line.split(',').map((c) => c.trim());
        return {
          name: cols[nameIdx] || '',
          email: cols[emailIdx] || '',
          phone: phoneIdx !== -1 ? cols[phoneIdx] || '' : '',
          city: cityIdx !== -1 ? cols[cityIdx] || '' : '',
        };
      }).filter((c) => c.name && c.email);

      if (customers.length === 0) {
        setFormError('No valid customer rows found in CSV.');
        setSubmitting(false);
        return;
      }

      const result = await apiFetch<{ imported: number; errors: number }>('/customers/bulk', {
        method: 'POST',
        body: JSON.stringify(customers),
      });

      setFormSuccess(`Imported ${result.imported} customers${result.errors > 0 ? ` (${result.errors} errors)` : ''}.`);
      setBulkFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      loadCustomers(0);
      setTimeout(() => closeModal(), 1500);
    } catch (err: any) {
      setFormError(err.message || 'Bulk import failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold gradient-text inline-block">Customers</h1>
          <p className="text-[var(--color-text-secondary)] mt-2">
            {pagination.total} customers in your database
          </p>
        </div>
        <button
          id="add-customer-btn"
          onClick={openModal}
          className="px-5 py-2.5 rounded-xl text-white font-medium transition-all duration-200 hover:scale-105 flex items-center gap-2"
          style={{ background: 'var(--gradient-primary)' }}
        >
          <span className="text-lg leading-none">+</span>
          Add Customer
        </button>
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

      {/* Add Customer Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Modal */}
          <div
            className="relative glass rounded-2xl w-full max-w-lg animate-fade-in"
            style={{ boxShadow: 'var(--shadow-glow)' }}
          >
            {/* Close button */}
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card-hover)] transition-colors"
            >
              ✕
            </button>

            <div className="p-6">
              <h2 className="text-xl font-bold gradient-text inline-block mb-1">Add Customer</h2>
              <p className="text-sm text-[var(--color-text-muted)] mb-5">Add a single customer or import from CSV</p>

              {/* Tabs */}
              <div className="flex gap-1 p-1 rounded-xl bg-[var(--color-bg-input)] mb-5">
                <button
                  id="tab-single"
                  onClick={() => { setModalTab('single'); setFormError(''); setFormSuccess(''); }}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    modalTab === 'single'
                      ? 'text-white shadow-md'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                  }`}
                  style={modalTab === 'single' ? { background: 'var(--gradient-primary)' } : {}}
                >
                  Single
                </button>
                <button
                  id="tab-bulk"
                  onClick={() => { setModalTab('bulk'); setFormError(''); setFormSuccess(''); }}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    modalTab === 'bulk'
                      ? 'text-white shadow-md'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                  }`}
                  style={modalTab === 'bulk' ? { background: 'var(--gradient-primary)' } : {}}
                >
                  Bulk CSV
                </button>
              </div>

              {/* Error / Success messages */}
              {formError && (
                <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--color-danger-dim)', color: 'var(--color-danger)' }}>
                  {formError}
                </div>
              )}
              {formSuccess && (
                <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--color-success-dim)', color: 'var(--color-success)' }}>
                  {formSuccess}
                </div>
              )}

              {/* Single Customer Form */}
              {modalTab === 'single' && (
                <form onSubmit={handleSingleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">
                      Name <span className="text-[var(--color-danger)]">*</span>
                    </label>
                    <input
                      id="customer-name"
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="John Doe"
                      className="w-full px-4 py-2.5 rounded-xl bg-[var(--color-bg-input)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] transition-colors text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">
                      Email <span className="text-[var(--color-danger)]">*</span>
                    </label>
                    <input
                      id="customer-email"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="john@example.com"
                      className="w-full px-4 py-2.5 rounded-xl bg-[var(--color-bg-input)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] transition-colors text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">Phone</label>
                      <input
                        id="customer-phone"
                        type="text"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        placeholder="+91 98765 43210"
                        className="w-full px-4 py-2.5 rounded-xl bg-[var(--color-bg-input)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] transition-colors text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">City</label>
                      <input
                        id="customer-city"
                        type="text"
                        value={form.city}
                        onChange={(e) => setForm({ ...form, city: e.target.value })}
                        placeholder="Mumbai"
                        className="w-full px-4 py-2.5 rounded-xl bg-[var(--color-bg-input)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] transition-colors text-sm"
                      />
                    </div>
                  </div>
                  <button
                    id="submit-customer"
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3 rounded-xl text-white font-medium transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 mt-2"
                    style={{ background: 'var(--gradient-primary)' }}
                  >
                    {submitting ? 'Adding...' : 'Add Customer'}
                  </button>
                </form>
              )}

              {/* Bulk CSV Import */}
              {modalTab === 'bulk' && (
                <div className="space-y-4">
                  <div
                    className="border-2 border-dashed border-[var(--color-border)] rounded-xl p-8 text-center cursor-pointer hover:border-[var(--color-accent)] transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={(e) => setBulkFile(e.target.files?.[0] || null)}
                    />
                    <div className="text-3xl mb-2">📄</div>
                    {bulkFile ? (
                      <div>
                        <p className="text-sm font-medium text-[var(--color-text-primary)]">{bulkFile.name}</p>
                        <p className="text-xs text-[var(--color-text-muted)] mt-1">
                          {(bulkFile.size / 1024).toFixed(1)} KB — Click to change
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm text-[var(--color-text-secondary)]">Click to upload CSV file</p>
                        <p className="text-xs text-[var(--color-text-muted)] mt-1">
                          Required columns: <span className="text-[var(--color-accent-light)]">name</span>, <span className="text-[var(--color-accent-light)]">email</span> · Optional: phone, city
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="px-4 py-3 rounded-xl text-xs text-[var(--color-text-muted)]" style={{ background: 'var(--color-info-dim)' }}>
                    <span className="text-[var(--color-info)] font-medium">CSV Format: </span>
                    name, email, phone, city — one customer per line with a header row.
                  </div>

                  <button
                    id="submit-bulk"
                    onClick={handleBulkSubmit}
                    disabled={submitting || !bulkFile}
                    className="w-full py-3 rounded-xl text-white font-medium transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    style={{ background: 'var(--gradient-primary)' }}
                  >
                    {submitting ? 'Importing...' : `Import${bulkFile ? ` from ${bulkFile.name}` : ''}`}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
