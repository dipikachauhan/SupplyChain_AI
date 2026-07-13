import { Card, RiskBadge } from '../common'
import { formatDate } from '../../utils/formatters'

export default function NewsTimeline({ events }) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-cg-text">Latest event timeline</h2>
          <p className="mt-1 text-sm text-cg-muted">Most recent monitored events, ordered by publication date.</p>
        </div>
        <span className="shrink-0 text-xs font-medium text-cg-muted">{Math.min(events.length, 10)} latest events</span>
      </div>
      <div className="mt-5 max-h-80 overflow-y-auto pl-1">
        {events.slice(0, 10).map((event, index) => (
          <div key={event.id} className="relative flex gap-4 pb-5 last:pb-0">
            <div className="flex flex-col items-center">
              <span className="mt-1 h-3 w-3 rounded-full bg-cg-secondary ring-4 ring-cg-secondary/15" />
              {index < Math.min(events.length, 10) - 1 && <span className="mt-2 h-full w-px bg-cg-border" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-cg-text">{event.headline}</p>
                <RiskBadge level={event.severity} />
              </div>
              <p className="mt-1 text-xs text-cg-muted">
                {formatDate(event.date)} · {event.risk_category || '—'} · {event.country || '—'}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

