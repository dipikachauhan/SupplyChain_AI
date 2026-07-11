import { getRiskStyles } from '../../utils/riskHelpers'
import { cn } from '../../utils/formatters'

export default function RiskBadge({ level, label, className = '' }) {
  const styles = getRiskStyles(level)
  const displayLabel = label || level || styles.label

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium capitalize',
        styles.badge,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', styles.dot)} />
      {displayLabel}
    </span>
  )
}
