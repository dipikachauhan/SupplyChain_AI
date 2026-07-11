import { NavLink } from 'react-router-dom'
import { Shield, X } from 'lucide-react'
import { APP_NAME, APP_TAGLINE, NAV_ITEMS } from '../constants/navigation'
import { cn } from '../utils/formatters'

export default function Sidebar({ isOpen, onClose }) {
  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/50 transition-opacity lg:hidden',
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-cg-border bg-cg-card transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-cg-border px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-cg bg-cg-primary">
              <Shield className="h-5 w-5 text-cg-text" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-cg-text">{APP_NAME}</p>
              <p className="truncate text-xs text-cg-muted">{APP_TAGLINE}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-cg p-2 text-cg-muted transition-colors hover:bg-cg-hover hover:text-cg-text lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {NAV_ITEMS.map(({ label, path, icon: Icon, end }) => (
              <li key={path}>
                <NavLink
                  to={path}
                  end={end}
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-cg px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-cg-primary text-cg-text'
                        : 'text-cg-muted hover:bg-cg-hover hover:text-cg-text',
                    )
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-cg-border px-5 py-4">
          <p className="text-xs text-cg-muted">Enterprise Risk Intelligence</p>
          <p className="mt-1 text-xs font-medium text-cg-secondary">v1.0.0</p>
        </div>
      </aside>
    </>
  )
}
