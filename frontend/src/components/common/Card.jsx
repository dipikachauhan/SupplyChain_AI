import { cn } from '../../utils/formatters'

export default function Card({
  children,
  className = '',
  padding = 'default',
  ...props
}) {
  const paddingClass =
    padding === 'none' ? 'p-0' : padding === 'sm' ? 'p-3.5' : 'p-4'

  return (
    <div
      className={cn(
        'rounded-cg border border-cg-border bg-cg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
        paddingClass,
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
