import { Menu, Bell, Search } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { NAV_ITEMS } from '../constants/navigation'
import { useBackendStatus } from '../hooks/useBackendStatus'
import { cn } from '../utils/formatters'

function getPageTitle(pathname) {
  const match = NAV_ITEMS.find((item) =>
    item.end ? pathname === item.path : pathname.startsWith(item.path),
  )

  return match?.label || 'ChainGuard AI'
}

export default function TopNav({ onMenuClick }) {
  const location = useLocation()
  const backendStatus = useBackendStatus()
  const pageTitle = getPageTitle(location.pathname)

  const statusConfig = {
    online: {
      label: 'Backend Online',
      className: 'text-risk-safe',
      dotClass: 'bg-risk-safe',
    },
    offline: {
      label: 'Backend Offline',
      className: 'text-risk-high',
      dotClass: 'bg-risk-high',
    },
    checking: {
      label: 'Checking Connection',
      className: 'text-cg-secondary',
      dotClass: 'bg-cg-secondary animate-pulse',
    },
  }

  const status = statusConfig[backendStatus]

  return (
    <header className="sticky top-0 z-30 border-b border-cg-border bg-cg-bg/95 backdrop-blur">
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            className="rounded-cg p-2 text-cg-muted transition-colors hover:bg-cg-hover hover:text-cg-text lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="min-w-0">
            <p className="truncate text-xs font-medium uppercase tracking-[0.18em] text-cg-secondary">
              Operations Console
            </p>
            <h2 className="truncate text-lg font-semibold text-cg-text">{pageTitle}</h2>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden items-center gap-2 rounded-cg border border-cg-border bg-cg-card px-3 py-2 md:flex">
            <Search className="h-4 w-4 text-cg-muted" />
            <input
              type="search"
              placeholder="Search modules…"
              className="w-44 bg-transparent text-sm text-cg-text outline-none placeholder:text-cg-muted lg:w-56"
              aria-label="Search modules"
            />
          </div>

          <div
            className={cn(
              'hidden items-center gap-2 rounded-cg border border-cg-border bg-cg-card px-3 py-2 text-xs font-medium sm:flex',
              status.className,
            )}
          >
            <span className={cn('h-2 w-2 rounded-full', status.dotClass)} />
            {status.label}
          </div>

          <button
            type="button"
            className="rounded-cg border border-cg-border bg-cg-card p-2 text-cg-muted transition-colors hover:bg-cg-hover hover:text-cg-text"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
          </button>

          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-cg-border bg-cg-primary text-xs font-semibold text-cg-text">
            DC
          </div>
        </div>
      </div>
    </header>
  )
}
