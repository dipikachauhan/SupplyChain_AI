import { Bell, Menu, UserCircle2 } from 'lucide-react'
import { useBackendStatus } from '../hooks/useBackendStatus'
import { cn } from '../utils/formatters'

export default function TopNav({ onMenuClick }) {
  const backendStatus = useBackendStatus()
  const statusConfig = {
    online: { label: 'Backend Online', className: 'text-risk-safe', dotClass: 'bg-risk-safe' },
    offline: { label: 'Backend Offline', className: 'text-risk-high', dotClass: 'bg-risk-high' },
    checking: { label: 'Checking Connection', className: 'text-cg-secondary', dotClass: 'bg-cg-secondary animate-pulse' },
  }
  const status = statusConfig[backendStatus]

  return (
    <header className="sticky top-0 z-30 border-b border-cg-border bg-cg-bg/95 backdrop-blur">
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={onMenuClick} className="rounded-cg p-2 text-cg-muted transition-colors hover:bg-cg-hover hover:text-cg-text lg:hidden" aria-label="Open navigation">
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium uppercase tracking-[0.18em] text-cg-secondary">SupplyLens AI</p>
            <p className="truncate text-sm text-cg-muted">AI-Powered Supply Chain Risk Intelligence Platform</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <div className={cn('hidden items-center gap-2 rounded-cg border border-cg-border bg-cg-card px-3 py-2 text-xs font-medium sm:flex', status.className)}>
            <span className={cn('h-2 w-2 rounded-full', status.dotClass)} />
            {status.label}
          </div>
          <button type="button" className="rounded-cg border border-cg-border bg-cg-card p-2 text-cg-muted transition-colors hover:bg-cg-hover hover:text-cg-text focus:outline-none focus:ring-2 focus:ring-cg-secondary/40" aria-label="Notifications">
            <Bell className="h-4 w-4" />
          </button>
          <button type="button" aria-label="Open profile" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cg-border bg-cg-card text-cg-secondary transition-colors hover:bg-cg-hover focus:outline-none focus:ring-2 focus:ring-cg-secondary/40">
            <UserCircle2 className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  )
}
