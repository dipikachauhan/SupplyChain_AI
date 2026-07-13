import { AlertCircle, RefreshCw } from 'lucide-react'
import Card from './Card'

export default function ErrorState({
  title = 'Unable to load data',
  message = 'Something went wrong while fetching data from the server.',
  onRetry,
}) {
  return (
    <Card className="border-risk-high/30 bg-cg-card">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-cg bg-risk-high/10">
          <AlertCircle className="h-5 w-5 text-risk-high" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold text-cg-text">{title}</h3>
          <p className="mt-1 text-sm text-cg-muted">{message}</p>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-cg border border-cg-border bg-cg-hover px-3 py-2 text-sm font-medium text-cg-text transition-colors hover:border-cg-secondary hover:text-cg-secondary"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        )}
      </div>
    </Card>
  )
}
