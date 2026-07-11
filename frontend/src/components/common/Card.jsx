import { cn } from '../../utils/formatters'

export default function Card({
  children,
  className = '',
  padding = 'default',
  ...props
}) {
  const paddingClass =
    padding === 'none' ? 'p-0' : padding === 'sm' ? 'p-4' : 'p-5'

  return (
    <div
      className={cn(
        'rounded-cg border border-cg-border bg-cg-card shadow-sm',
        paddingClass,
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
