'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/campaigns', label: 'Campaigns', icon: '📬' },
  { href: '/customers', label: 'Customers', icon: '👥' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved === 'true') setCollapsed(true);
  }, []);

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      localStorage.setItem('sidebar-collapsed', String(!prev));
      return !prev;
    });
  };

  return (
    <>
      <aside
        className={`fixed left-0 top-0 h-screen flex flex-col glass transition-all duration-300 ease-in-out ${
          collapsed ? 'w-[72px]' : 'w-64'
        }`}
        style={{ zIndex: 50 }}
      >
        {/* Toggle button — centered on the right edge */}
        <button
          id="sidebar-toggle"
          onClick={toggleCollapse}
          className="absolute top-1/2 -translate-y-1/2 -right-4 w-8 h-8 rounded-full flex items-center justify-center text-sm text-white transition-all duration-200 hover:scale-125 shadow-lg cursor-pointer"
          style={{ zIndex: 51, background: 'var(--gradient-primary)', boxShadow: '0 0 16px rgba(108, 92, 231, 0.5)' }}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <span
            className="inline-block transition-transform duration-300"
            style={{ transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            ◀
          </span>
        </button>

        {/* Logo */}
        <div className={`border-b border-[var(--color-border)] ${collapsed ? 'p-4 flex justify-center' : 'p-6'}`}>
          <Link href="/" className="flex items-center gap-3 group">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0"
              style={{ background: 'var(--gradient-primary)' }}
            >
              X
            </div>
            {!collapsed && (
              <div className="overflow-hidden">
                <h1 className="text-lg font-bold text-[var(--color-text-primary)] group-hover:text-[var(--color-accent-light)] transition-colors whitespace-nowrap">
                  Xeno CRM
                </h1>
                <p className="text-xs text-[var(--color-text-muted)] whitespace-nowrap">AI Campaign Builder</p>
              </div>
            )}
          </Link>
        </div>

        {/* Navigation */}
        <nav className={`flex-1 space-y-1 ${collapsed ? 'p-2' : 'p-4'}`}>
          {navItems.map((item) => {
            const isActive = item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`
                  flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-200
                  ${collapsed ? 'px-0 py-3 justify-center' : 'px-4 py-3'}
                  ${isActive
                    ? 'bg-[var(--color-accent)] bg-opacity-15 text-[var(--color-accent-light)] shadow-lg'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card-hover)]'
                  }
                `}
                style={isActive ? { background: 'rgba(108, 92, 231, 0.15)', boxShadow: '0 0 20px rgba(108, 92, 231, 0.1)' } : {}}
              >
                <span className="text-lg shrink-0">{item.icon}</span>
                {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
                {isActive && !collapsed && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className={`border-t border-[var(--color-border)] ${collapsed ? 'p-2' : 'p-4'}`}>
          <div className={`flex items-center gap-3 ${collapsed ? 'justify-center px-0 py-2' : 'px-4 py-3'}`}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: 'var(--gradient-primary)' }}>
              M
            </div>
            {!collapsed && (
              <div className="overflow-hidden">
                <p className="text-sm font-medium text-[var(--color-text-primary)] whitespace-nowrap">Marketer</p>
                <p className="text-xs text-[var(--color-text-muted)] whitespace-nowrap">Admin</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Spacer — pushes main content to the right */}
      <div
        className="shrink-0 transition-all duration-300 ease-in-out"
        style={{ width: collapsed ? '72px' : '256px' }}
      />
    </>
  );
}
