'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/campaigns', label: 'Campaigns', icon: '📬' },
  { href: '/campaigns/new', label: 'New Campaign', icon: '✨' },
  { href: '/customers', label: 'Customers', icon: '👥' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 flex flex-col glass" style={{ zIndex: 50 }}>
      {/* Logo */}
      <div className="p-6 border-b border-[var(--color-border)]">
        <Link href="/" className="flex items-center gap-3 group">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg"
            style={{ background: 'var(--gradient-primary)' }}
          >
            X
          </div>
          <div>
            <h1 className="text-lg font-bold text-[var(--color-text-primary)] group-hover:text-[var(--color-accent-light)] transition-colors">
              Xeno CRM
            </h1>
            <p className="text-xs text-[var(--color-text-muted)]">AI Campaign Builder</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = item.href === '/'
            ? pathname === '/'
            : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200
                ${isActive
                  ? 'bg-[var(--color-accent)] bg-opacity-15 text-[var(--color-accent-light)] shadow-lg'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card-hover)]'
                }
              `}
              style={isActive ? { background: 'rgba(108, 92, 231, 0.15)', boxShadow: '0 0 20px rgba(108, 92, 231, 0.1)' } : {}}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-[var(--color-border)]">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: 'var(--gradient-primary)' }}>
            M
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">Marketer</p>
            <p className="text-xs text-[var(--color-text-muted)]">Admin</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
