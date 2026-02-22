import React from 'react'
import { useStore } from '../store/useStore.jsx'
import { AiProviderToggle } from './AiPanel.jsx'

const NAV_ITEMS = [
  {
    id: 'dashboard',
    label: 'CISO Dashboard',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
  },
  {
    id: 'objects',
    label: 'Object Inventory',
    subtitle: 'Program Health',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
        <line x1="12" y1="22.08" x2="12" y2="12"/>
      </svg>
    ),
  },
  {
    id: 'onelist',
    label: 'OneList',
    subtitle: 'Intake Pipeline',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
  },
  {
    id: 'mlg',
    label: 'MLG',
    subtitle: 'Diagnostic',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
  },
  {
    id: 'standup',
    label: 'Standup',
    subtitle: 'PPA Actions',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    id: 'guide',
    label: 'Guide',
    subtitle: 'How It Works',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
  },
  {
    id: 'data',
    label: 'Data',
    subtitle: 'Export / Import',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
    ),
  },
]

const FRAMEWORK_ITEMS = [
  {
    id: 'cis-v8',
    label: 'CIS v8.1',
    subtitle: '153 Safeguards',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        <polyline points="9 12 11 14 15 10"/>
      </svg>
    ),
  },
  {
    id: 'nist-csf',
    label: 'NIST CSF 2.0',
    subtitle: '6 Functions',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"/>
      </svg>
    ),
  },
  {
    id: 'glba',
    label: 'GLBA',
    subtitle: '47 Safeguards',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        <path d="M8 11h8M8 15h5"/>
      </svg>
    ),
  },
  {
    id: 'nydfs',
    label: 'NYDFS 500',
    subtitle: '43 Safeguards',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <path d="M12 8v8M8 12h8"/>
      </svg>
    ),
  },
]

function NavItem({ item, isActive, onClick, badge }) {
  return (
    <button
      className={`group relative flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-[10px] border-none cursor-pointer font-sans transition-all duration-200 ${
        isActive
          ? 'bg-white/[0.08] backdrop-blur-sm text-txt-white shadow-[0_0_20px_rgba(37,99,235,0.08)]'
          : 'bg-transparent text-white/45 hover:bg-white/[0.07] hover:text-white/90'
      }`}
      onClick={onClick}
    >
      {isActive && (
        <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-[3px] h-[22px] rounded-r-[3px] bg-gradient-to-b from-brand to-ai shadow-[0_0_8px_rgba(37,99,235,0.5)] transition-all duration-300" />
      )}
      <span className={`w-[22px] flex items-center justify-center shrink-0 transition-all duration-200 ${
        isActive ? 'opacity-100 text-blue-300' : 'opacity-45 group-hover:opacity-80 group-hover:scale-105'
      }`}>
        {item.icon}
      </span>
      <span className="flex flex-col min-w-0">
        <span className={`text-[0.85rem] block tracking-tight ${isActive ? 'font-semibold' : 'font-[560]'}`}>
          {item.label}
        </span>
        {item.subtitle && (
          <span className={`text-[0.67rem] block ${
            isActive ? 'text-blue-300/50' : 'text-white/20'
          }`}>
            {item.subtitle}
          </span>
        )}
      </span>
      {badge > 0 && (
        <span className="ml-auto text-[0.68rem] font-bold text-white bg-amber rounded-full px-2 py-0.5 min-w-[22px] text-center animate-[badgePulse_2s_infinite]">
          {badge}
        </span>
      )}
    </button>
  )
}

export default function Sidebar({ activePage, onNavigate, mobileOpen }) {
  const { regulatoryQueue, gaps } = useStore()
  const pendingCount = (regulatoryQueue || []).filter((q) => q.status === 'pending').length
  const untriagedCount = (gaps || []).filter((g) => !g.triaged).length

  return (
    <aside
      className={`w-[--spacing-sidebar] shrink-0 bg-gradient-to-b from-dark via-[#111827] to-[#0f172a] flex flex-col border-r border-white/[0.06] sticky top-0 h-screen transition-transform duration-300 max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-[1000] max-md:shadow-2xl ${
        mobileOpen ? 'max-md:translate-x-0' : 'max-md:-translate-x-full'
      }`}
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-5 border-b border-white/[0.07]">
        <div className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-brand to-ai flex items-center justify-center shadow-[0_4px_16px_rgba(37,99,235,0.4),0_0_24px_rgba(124,58,237,0.15)]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        </div>
        <div>
          <span className="text-base font-[750] text-txt-white block tracking-tight">CPM</span>
          <span className="text-[0.7rem] text-[rgba(148,163,184,0.6)] font-medium tracking-[0.04em] uppercase block">Cyber Product Mgmt</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 flex flex-col gap-0.5 overflow-y-auto" aria-label="Primary">
        <div className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-white/45 px-3 pt-3 pb-1.5 mt-0.5">Main</div>
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.id}
            item={item}
            isActive={activePage === item.id || (item.id === 'objects' && activePage === 'object-detail')}
            onClick={() => onNavigate(item.id)}
            badge={item.id === 'onelist' ? untriagedCount : 0}
          />
        ))}

        <div className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-white/45 px-3 pt-4 pb-1.5 mt-1">Frameworks</div>
        {FRAMEWORK_ITEMS.map((item) => (
          <NavItem
            key={item.id}
            item={item}
            isActive={activePage === item.id}
            onClick={() => onNavigate(item.id)}
          />
        ))}

        <div className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-white/45 px-3 pt-4 pb-1.5 mt-1">Compliance</div>
        <button
          className={`group relative flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-[10px] border-none cursor-pointer font-sans transition-all duration-200 ${
            activePage === 'regulatory'
              ? 'bg-white/[0.08] backdrop-blur-sm text-txt-white shadow-[0_0_20px_rgba(37,99,235,0.08)]'
              : 'bg-transparent text-white/45 hover:bg-white/[0.07] hover:text-white/90'
          }`}
          onClick={() => onNavigate('regulatory')}
        >
          {activePage === 'regulatory' && (
            <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-[3px] h-[22px] rounded-r-[3px] bg-gradient-to-b from-brand to-ai shadow-[0_0_8px_rgba(37,99,235,0.5)] transition-all duration-300" />
          )}
          <span className={`w-[22px] flex items-center justify-center shrink-0 transition-all duration-200 ${
            activePage === 'regulatory' ? 'opacity-100 text-blue-300' : 'opacity-45 group-hover:opacity-80'
          }`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <path d="M9 12l2 2 4-4"/>
            </svg>
          </span>
          <span className="flex flex-col min-w-0">
            <span className={`text-[0.85rem] block tracking-tight ${activePage === 'regulatory' ? 'font-semibold' : 'font-[560]'}`}>Regulatory</span>
            <span className={`text-[0.67rem] block ${activePage === 'regulatory' ? 'text-blue-300/50' : 'text-white/20'}`}>Attestations</span>
          </span>
          {pendingCount > 0 && (
            <span className="ml-auto text-[0.68rem] font-bold text-white bg-red rounded-full px-2 py-0.5 min-w-[22px] text-center animate-[badgePulse_2s_infinite]">
              {pendingCount}
            </span>
          )}
        </button>
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-white/[0.06] flex flex-col gap-2">
        <AiProviderToggle />
        <div className="text-[0.68rem] text-white/45">
          <span className="block">Security Product Mgmt</span>
          <span className="block mt-0.5 text-white/30">v0.1 MVP</span>
        </div>
      </div>
    </aside>
  )
}
