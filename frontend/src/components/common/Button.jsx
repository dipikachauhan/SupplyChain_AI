import { cn } from '../../utils/formatters'

const variants = {
  primary:
    'border-cg-primary bg-cg-primary text-cg-text hover:bg-cg-primary/90',
  secondary:
    'border-cg-border bg-cg-hover text-cg-text hover:border-cg-secondary',
  ghost: 'border-transparent bg-transparent text-cg-muted hover:bg-cg-hover hover:text-cg-text',
}

const sizes = {
  sm: 'px-2.5 py-1.5 text-xs',
  md: 'px-3 py-2 text-sm',
}

export default function Button({
  children,
  variant = 'secondary',
  size = 'md',
  className = '',
  ...props
}) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-cg border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
