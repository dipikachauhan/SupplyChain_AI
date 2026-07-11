import { Loader2 } from 'lucide-react'
import { cn } from '../../utils/formatters'

export default function LoadingSpinner({
  label = 'Loading data…',
  size = 'md',
  className = '',
}) {
  const sizeClass = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-8 w-8' : 'h-6 w-6'

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 py-12 text-cg-muted',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <Loader2 className={cn('animate-spin text-cg-secondary', sizeClass)} />
      <p className="text-sm">{label}</p>
    </div>
  )
}
