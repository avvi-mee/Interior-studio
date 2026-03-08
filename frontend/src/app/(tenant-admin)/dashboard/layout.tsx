'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useTenantAuth } from '@/hooks/useTenantAuth'
import { useBrand } from '@/hooks/useWebsiteBuilder'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useContracts } from '@/hooks/useContracts'
import { useLeads } from '@/hooks/useLeads'
import { getAllowedSidebarHrefs } from '@/lib/permissions'

// ─── Inline SVG Icons ─────────────────────────────────────────────────────────
const Icons = {
  grid: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  target: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
    </svg>
  ),
  chat: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  book: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
    </svg>
  ),
  check: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  ),
  dollar: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  ),
  building: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  users: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  globe: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  ),
  settings: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  logout: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
  chevDown: (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  ),
  plus: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  bell: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
  search: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
  menu: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  ),
  close: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  sun: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  ),
  moon: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  ),
  barChart: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
    </svg>
  ),
  external: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
      <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
    </svg>
  ),
}

// ─── Nav config ───────────────────────────────────────────────────────────────
interface NavItem  { label: string; href: string; icon: React.ReactNode; badgeKey?: 'leads' | 'contracts'; badgeStyle?: 'teal' | 'amber' | 'red' }
interface NavGroup { label?: string; items: NavItem[]; divider?: boolean }

const NAV_GROUPS: NavGroup[] = [
  {
    divider: true,
    items: [
      { label: 'Dashboard',      href: '/dashboard',                       icon: Icons.grid    },
      { label: 'Sales Pipeline', href: '/dashboard/orders',                icon: Icons.target, badgeKey: 'leads',     badgeStyle: 'teal' },
      { label: 'Consultations',  href: '/dashboard/consultation-requests', icon: Icons.chat    },
      { label: 'Projects',       href: '/dashboard/projects',              icon: Icons.book    },
      { label: 'Contracts',      href: '/dashboard/contracts',             icon: Icons.check,  badgeKey: 'contracts', badgeStyle: 'red'  },
    ],
  },
  {
    label: 'Finance',
    divider: true,
    items: [
      { label: 'Finance',  href: '/dashboard/finance',  icon: Icons.dollar   },
      { label: 'Vendors',  href: '/dashboard/vendors',  icon: Icons.building },
    ],
  },
  {
    divider: true,
    items: [
      { label: 'Employees',  href: '/dashboard/employees', icon: Icons.users    },
      { label: 'Analytics',  href: '/dashboard/analytics', icon: Icons.barChart },
    ],
  },
  {
    label: 'Setup',
    items: [
      { label: 'Website Setup',  href: '/dashboard/website-setup', icon: Icons.globe    },
      { label: 'Pricing Config', href: '/dashboard/pricing',        icon: Icons.dollar   },
      { label: 'Settings',       href: '/dashboard/settings',       icon: Icons.settings },
    ],
  },
]

const HREF_TO_LABEL: Record<string, string> = {
  '/dashboard':                       'Dashboard',
  '/dashboard/orders':                'Sales Pipeline',
  '/dashboard/consultation-requests': 'Consultations',
  '/dashboard/projects':              'Projects',
  '/dashboard/contracts':             'Contracts',
  '/dashboard/finance':               'Finance',
  '/dashboard/vendors':               'Vendors',
  '/dashboard/employees':             'Employees',
  '/dashboard/analytics':             'Analytics',
  '/dashboard/website-setup':         'Website Setup',
  '/dashboard/pricing':               'Pricing Config',
  '/dashboard/settings':              'Settings',
}

const ROLE_META: Record<string, { label: string; color: string }> = {
  owner:           { label: 'Owner',          color: '#F59E0B' },
  admin:           { label: 'Admin',          color: '#8B5CF6' },
  sales:           { label: 'Sales',          color: '#10B981' },
  designer:        { label: 'Designer',       color: '#3B82F6' },
  site_supervisor: { label: 'Supervisor',     color: '#EF4444' },
  accountant:      { label: 'Accountant',     color: '#06B6D4' },
  project_manager: { label: 'PM',             color: '#F97316' },
}

function getInitials(name: string): string {
  return (name ?? '').split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '??'
}

// ─── Layout ───────────────────────────────────────────────────────────────────
export default function TenantLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()

  const { tenant, loading, isAuthenticated, logout } = useTenantAuth()
  const { brand }                                    = useBrand(tenant?.id ?? null)
  const { roles, firebaseUser, userType }            = useCurrentUser()
  const { stats: contractStats }                     = useContracts(tenant?.id ?? null)
  const { leads }                                    = useLeads(tenant?.id ?? null)

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [theme, setTheme]             = useState<'light' | 'dark'>('light')

  // Load theme from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('unmatrix-theme') as 'light' | 'dark' | null
    const initial = saved ?? 'light'
    setTheme(initial)
    document.documentElement.setAttribute('data-theme', initial)
  }, [])

  const toggleTheme = () => {
    const next: 'light' | 'dark' = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    localStorage.setItem('unmatrix-theme', next)
    document.documentElement.setAttribute('data-theme', next)
  }

  const effectiveRoles  = roles.length > 0 ? roles : userType === 'employee' ? [] : ['owner']
  const allowedHrefs    = getAllowedSidebarHrefs(effectiveRoles)
  const leadsCount      = leads.length
  const expiringCount   = contractStats.expiring

  const displayName  = firebaseUser?.displayName || firebaseUser?.email?.split('@')[0] || 'Admin'
  const primaryRole  = roles[0] ?? 'owner'
  const initials     = getInitials(displayName)
  const roleMeta     = ROLE_META[primaryRole] ?? { label: primaryRole.replace(/_/g, ' '), color: '#8E8E93' }
  const studioName   = brand?.brandName || tenant?.name || 'Studio'
  const logoUrl      = brand?.logoUrl

  const currentPageLabel = useMemo(() => HREF_TO_LABEL[pathname] ?? 'Dashboard', [pathname])

  function isActive(href: string): boolean {
    if (href === '/dashboard') return pathname === '/dashboard' || pathname === '/dashboard/'
    return pathname.startsWith(href)
  }

  function getBadgeCount(key?: string): number {
    if (key === 'leads')     return leadsCount
    if (key === 'contracts') return expiringCount
    return 0
  }

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push('/login')
  }, [loading, isAuthenticated, router])

  useEffect(() => { setSidebarOpen(false) }, [pathname])

  const handleLogout = async () => { await logout(); router.push('/login') }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: 'var(--mesh-base)' }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="h-8 w-8 rounded-full border-2 border-transparent"
          style={{
            borderTopColor: 'var(--brand)',
            borderRightColor: 'var(--brand-border)',
          }}
        />
      </div>
    )
  }

  if (!isAuthenticated) return null

  // ── Sidebar ────────────────────────────────────────────────────────────────
  const SidebarContent = (
    <div className="flex flex-col h-full" style={{ fontFamily: "'Geist', system-ui, sans-serif" }}>

      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 py-[14px]" style={{ borderBottom: '1px solid var(--sb-divider)' }}>
        {logoUrl ? (
          <img src={logoUrl} alt={studioName}
            className="h-8 w-8 rounded-[10px] object-cover flex-shrink-0"
            style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}
          />
        ) : (
          <div
            className="h-8 w-8 rounded-[10px] flex items-center justify-center text-white text-[11px] font-black flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, #F97316, #EF4444)',
              boxShadow: theme === 'dark'
                ? '0 2px 12px rgba(239,68,68,0.38)'
                : '0 2px 8px rgba(239,68,68,0.20)',
            }}
          >
            {getInitials(studioName)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-[700] truncate leading-tight" style={{ color: 'var(--fg-900)', letterSpacing: '-0.2px' }}>
            {studioName}
          </div>
          <div className="text-[10px] font-[500] mt-px" style={{ color: 'var(--fg-400)' }}>
            Interior Studio
          </div>
        </div>
        <button
          onClick={() => { if (tenant?.id) window.open(`/${tenant.id}`, '_blank') }}
          title="Open website"
          className="h-6 w-6 rounded-md flex items-center justify-center flex-shrink-0 transition-all"
          style={{ color: 'var(--fg-400)' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--brand)'; e.currentTarget.style.background = 'var(--brand-bg)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--fg-400)'; e.currentTarget.style.background = 'transparent' }}
        >
          {Icons.external}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-2.5" style={{ scrollbarWidth: 'none' }}>
        <style>{`aside nav::-webkit-scrollbar { display: none; }`}</style>

        {NAV_GROUPS.map((group, gi) => {
          const visibleItems = group.items.filter(item => allowedHrefs.has(item.href))
          if (visibleItems.length === 0) return null

          return (
            <div key={gi}>
              {group.label && (
                <div
                  className="text-[9px] font-[700] uppercase px-2.5 pt-3 pb-1.5 tracking-widest"
                  style={{ color: 'var(--fg-400)' }}
                >
                  {group.label}
                </div>
              )}

              {visibleItems.map(item => {
                const active = isActive(item.href)
                const badge  = getBadgeCount(item.badgeKey)

                return (
                  <Link key={item.href} href={item.href}>
                    <motion.div
                      whileHover={{ x: active ? 0 : 2 }}
                      transition={{ duration: 0.15 }}
                      className="relative flex items-center gap-2.5 px-2.5 py-[7px] rounded-[8px] mb-[1px] select-none cursor-pointer"
                      style={{
                        color:      active ? 'var(--sb-active-fg)' : 'var(--sb-text)',
                        background: active ? 'var(--sb-active-bg)' : 'transparent',
                        fontWeight: active ? 600 : 500,
                        fontSize:   '13px',
                        transition: 'background 0.15s, color 0.15s',
                      }}
                      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--sb-hover)' }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
                    >
                      {/* Active indicator bar */}
                      <AnimatePresence>
                        {active && (
                          <motion.div
                            layoutId="sidebar-indicator"
                            className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full"
                            style={{ width: '3px', height: '18px', background: 'var(--sb-active-bar)' }}
                            initial={{ opacity: 0, scaleY: 0 }}
                            animate={{ opacity: 1, scaleY: 1 }}
                            exit={{ opacity: 0, scaleY: 0 }}
                            transition={{ duration: 0.2 }}
                          />
                        )}
                      </AnimatePresence>

                      {/* Icon */}
                      <span
                        className="flex items-center justify-center flex-shrink-0"
                        style={{ width: '18px', color: active ? 'var(--sb-icon-act)' : 'var(--sb-icon)' }}
                      >
                        {item.icon}
                      </span>

                      {/* Label */}
                      <span className="flex-1 truncate leading-none">{item.label}</span>

                      {/* Badge */}
                      {badge > 0 && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="text-[10px] font-[700] px-[6px] py-[1px] rounded-full min-w-[18px] text-center flex-shrink-0"
                          style={
                            item.badgeStyle === 'red'
                              ? { background: 'var(--red-bg)', color: 'var(--red)' }
                              : item.badgeStyle === 'amber'
                              ? { background: 'var(--amber-bg)', color: 'var(--amber)' }
                              : { background: 'var(--brand-bg)', color: 'var(--brand)' }
                          }
                        >
                          {badge}
                        </motion.span>
                      )}
                    </motion.div>
                  </Link>
                )
              })}

              {group.divider && (
                <div className="my-2 mx-1" style={{ height: '1px', background: 'var(--sb-divider)' }} />
              )}
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-2 pb-3 pt-2" style={{ borderTop: '1px solid var(--sb-divider)' }}>
        {/* User card */}
        <div
          className="flex items-center gap-2 px-2.5 py-2 rounded-[8px] mb-1.5 cursor-default transition-all"
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--sb-hover)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        >
          <div
            className="h-7 w-7 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[10px] font-black"
            style={{ background: `linear-gradient(135deg, ${roleMeta.color}, ${roleMeta.color}bb)` }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-[600] truncate leading-tight" style={{ color: 'var(--fg-900)' }}>
              {displayName}
            </div>
            <div
              className="text-[9px] font-[700] mt-px uppercase tracking-wide"
              style={{ color: roleMeta.color }}
            >
              {roleMeta.label}
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="h-6 w-6 rounded-md flex items-center justify-center flex-shrink-0 transition-all"
            style={{ color: 'var(--fg-400)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--red-bg)'; e.currentTarget.style.color = 'var(--red)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--fg-400)' }}
          >
            {Icons.logout}
          </button>
        </div>

        {/* Theme toggle + branding */}
        <div className="flex items-center gap-2 px-1">
          {/* Theme pill */}
          <button
            onClick={toggleTheme}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            className="relative flex items-center rounded-full flex-shrink-0 transition-all duration-300"
            style={{
              width: '48px',
              height: '24px',
              background: theme === 'dark'
                ? 'linear-gradient(135deg, #1E293B, #0F172A)'
                : 'linear-gradient(135deg, #BAE6FD, #E0F2FE)',
              border: '1px solid var(--glass-border-in)',
              boxShadow: 'var(--glass-shadow)',
            }}
          >
            <motion.div
              layout
              className="absolute flex items-center justify-center rounded-full"
              style={{
                width: '18px',
                height: '18px',
                left: theme === 'dark' ? '26px' : '3px',
                background: theme === 'dark'
                  ? 'linear-gradient(135deg, #6366F1, #8B5CF6)'
                  : 'linear-gradient(135deg, #FCD34D, #F59E0B)',
                boxShadow: theme === 'dark'
                  ? '0 0 8px rgba(139,92,246,0.5)'
                  : '0 0 8px rgba(252,211,77,0.5)',
                color: 'white',
              }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            >
              {theme === 'dark' ? Icons.moon : Icons.sun}
            </motion.div>
          </button>

          <div
            className="flex-1 text-center text-[8px] font-[800] tracking-[0.2em]"
            style={{ color: 'var(--fg-200)' }}
          >
            UNMATRIX
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div
      className="flex h-screen overflow-hidden theme-transition"
      style={{ fontFamily: "'Geist', system-ui, sans-serif", background: 'var(--mesh-base)' }}
    >

      {/* ── Mobile overlay ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-20 lg:hidden"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <aside
        className={cn(
          'fixed lg:relative left-0 top-0 h-full z-30 flex-shrink-0 glass-sidebar',
          'transition-transform duration-300 ease-out lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{ width: '228px', minWidth: '228px' }}
      >
        {SidebarContent}
      </aside>

      {/* ── Main ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Header */}
        <header
          className="flex items-center px-5 gap-3 flex-shrink-0 glass-header"
          style={{ height: '50px' }}
        >
          {/* Mobile hamburger */}
          <button
            className="lg:hidden flex items-center justify-center p-1 rounded-lg transition-all"
            style={{ color: 'var(--fg-400)' }}
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? Icons.close : Icons.menu}
          </button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-[12.5px]">
            <span style={{ color: 'var(--fg-400)', fontWeight: 500 }}>
              {tenant?.name ?? 'Studio'}
            </span>
            <span style={{ color: 'var(--fg-200)' }}>/</span>
            <span style={{ color: 'var(--fg-900)', fontWeight: 700 }}>
              {currentPageLabel}
            </span>
          </div>

          <div className="flex-1" />

          {/* Search */}
          <div
            className="hidden md:flex items-center gap-2 px-3 py-[5px] rounded-lg cursor-text transition-all"
            style={{
              background: 'var(--glass)',
              border: '1px solid var(--glass-border-in)',
              color: 'var(--fg-400)',
              fontSize: '12px',
            }}
          >
            {Icons.search}
            <span>Search</span>
            <kbd
              className="text-[9.5px] px-1.5 py-[2px] rounded"
              style={{ background: 'var(--glass-border-in)', color: 'var(--fg-400)', fontFamily: 'inherit' }}
            >
              ⌘K
            </kbd>
          </div>

          {/* Bell */}
          <motion.button
            whileTap={{ scale: 0.92 }}
            className="relative h-8 w-8 rounded-lg flex items-center justify-center transition-all"
            style={{
              background: 'var(--glass)',
              border: '1px solid var(--glass-border-in)',
              color: 'var(--fg-500)',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--fg-900)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--fg-500)' }}
          >
            {Icons.bell}
          </motion.button>

          {/* Theme toggle */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.92 }}
            onClick={toggleTheme}
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            className="relative h-8 rounded-full flex items-center px-1 gap-0 flex-shrink-0 transition-all duration-300"
            style={{
              width: '56px',
              background: theme === 'dark'
                ? 'linear-gradient(135deg, #1E1B4B, #0F0A1E)'
                : 'linear-gradient(135deg, #BAE6FD, #FDE68A)',
              border: '1px solid var(--glass-border-in)',
              boxShadow: theme === 'dark'
                ? '0 0 12px rgba(139,92,246,0.25)'
                : '0 0 12px rgba(252,211,77,0.30)',
            }}
          >
            {/* Track labels */}
            <span className="absolute left-[7px] text-[9px]" style={{ opacity: theme === 'light' ? 0 : 0.6 }}>🌙</span>
            <span className="absolute right-[7px] text-[9px]" style={{ opacity: theme === 'dark' ? 0 : 0.6 }}>☀️</span>
            {/* Sliding knob */}
            <motion.div
              layout
              transition={{ type: 'spring', stiffness: 600, damping: 35 }}
              className="absolute flex items-center justify-center rounded-full text-white"
              style={{
                width: '22px',
                height: '22px',
                left: theme === 'dark' ? '30px' : '3px',
                background: theme === 'dark'
                  ? 'linear-gradient(135deg, #7C3AED, #4F46E5)'
                  : 'linear-gradient(135deg, #F59E0B, #EF4444)',
                boxShadow: theme === 'dark'
                  ? '0 2px 8px rgba(124,58,237,0.6)'
                  : '0 2px 8px rgba(245,158,11,0.6)',
                fontSize: '10px',
              }}
            >
              {theme === 'dark' ? '🌙' : '☀️'}
            </motion.div>
          </motion.button>

          {/* New Estimate CTA */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => { if (tenant?.id) window.open(`/${tenant.id}/estimate`, '_blank') }}
            className="hidden md:flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-white text-[12px] font-[600]"
            style={{
              background: 'linear-gradient(135deg, var(--brand), var(--brand-dark))',
              boxShadow: '0 2px 10px var(--brand-glow)',
            }}
          >
            {Icons.plus}
            <span>New Estimate</span>
          </motion.button>
        </header>

        {/* Page content — with background mesh orbs */}
        <main
          className="flex-1 overflow-y-auto relative"
          style={{ background: 'var(--mesh-base)' }}
        >
          {/* Ambient orbs */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div
              className="absolute w-[500px] h-[500px] rounded-full blur-[96px] -top-32 -left-32 animate-float"
              style={{ background: 'var(--mesh-1)', opacity: theme === 'dark' ? 0.6 : 0.45 }}
            />
            <div
              className="absolute w-[400px] h-[400px] rounded-full blur-[80px] top-1/2 -right-20 animate-float2"
              style={{ background: 'var(--mesh-2)', opacity: theme === 'dark' ? 0.5 : 0.35 }}
            />
            <div
              className="absolute w-[320px] h-[320px] rounded-full blur-[72px] bottom-0 left-1/3 animate-float"
              style={{ background: 'var(--mesh-3)', opacity: theme === 'dark' ? 0.4 : 0.30, animationDelay: '-10s' }}
            />
          </div>

          {/* Content */}
          <div className="relative z-10 p-7 max-w-[1340px] mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
