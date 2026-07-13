import { Link } from 'react-router-dom'
import { X, GitBranch, FlaskConical, Sparkles, Truck, ShieldAlert } from 'lucide-react'
import { Button, ErrorState, LoadingSpinner, RiskBadge } from '../common'
import { formatDate, formatNumber, formatPercent } from '../../utils/formatters'

function DetailRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-cg-border/70 py-3 last:border-b-0">
      <span className="text-sm text-cg-muted">{label}</span>
      <span className="text-right text-sm font-medium text-cg-text">{value ?? '—'}</span>
    </div>
  )
}

export default function NewsDetailsDrawer({ event, loading, error, onRetry, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close news details"
        className="absolute inset-0 bg-cg-primary/20 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside className="relative h-full w-full max-w-2xl overflow-y-auto border-l border-cg-border bg-cg-card p-5 shadow-xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-cg-muted">News event</p>
            <h2 className="mt-1 text-xl font-semibold text-cg-text">{event?.headline || 'News details'}</h2>
          </div>
          <Button size="sm" aria-label="Close news details" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {loading && <LoadingSpinner label="Loading news details..." />}
        
        {!loading && error && (
          <ErrorState title="Unable to load news details" message={error} onRetry={onRetry} />
        )}
        
        {!loading && !error && event && (
          <>
            <div className="mt-5 flex flex-wrap gap-2">
              <RiskBadge level={event.severity} />
              <RiskBadge level={event.status} label={`Status: ${event.status || 'Open'}`} />
            </div>

            <p className="mt-5 rounded-cg border border-cg-border bg-cg-hover p-4 text-sm leading-6 text-cg-muted">
              {event.summary || 'No summary available.'}
            </p>

            {/* Workflow Navigation Section */}
            <div className="mt-5 rounded-cg border border-cg-border bg-cg-hover/40 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-cg-text">Operational Connections</h3>
              <p className="mt-1 text-xs text-cg-muted">Navigate to related supply chain modules or run disruption assessments.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                {/* Active Connections */}
                {event.affected_supplier && (
                  <>
                    <Link
                      to={`/suppliers?supplier_id=${event.affected_supplier}`}
                      className="flex items-center gap-2 rounded-cg border border-cg-primary bg-cg-primary px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-cg-primary-hover"
                    >
                      <Truck className="h-3.5 w-3.5 text-white" />
                      View Supplier
                    </Link>
                    <Link
                      to={`/risk?supplier_id=${event.affected_supplier}`}
                      className="flex items-center gap-2 rounded-cg border border-cg-primary bg-cg-primary px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-cg-primary-hover"
                    >
                      <ShieldAlert className="h-3.5 w-3.5 text-white" />
                      View Risk Analysis
                    </Link>
                  </>
                )}

                {/* Downstream Modules (Disabled but structure ready) */}
                <button
                  disabled
                  title="Downstream module - Coming Soon"
                  className="flex items-center gap-2 rounded-cg bg-cg-primary/40 px-3.5 py-2 text-xs font-medium text-cg-muted border border-cg-border opacity-50 cursor-not-allowed"
                >
                  <GitBranch className="h-3.5 w-3.5 text-cg-muted/70" />
                  Trace Network
                </button>
                <button
                  disabled
                  title="Downstream module - Coming Soon"
                  className="flex items-center gap-2 rounded-cg bg-cg-primary/40 px-3.5 py-2 text-xs font-medium text-cg-muted border border-cg-border opacity-50 cursor-not-allowed"
                >
                  <FlaskConical className="h-3.5 w-3.5 text-cg-muted/70" />
                  Simulate Disruption
                </button>
                <button
                  disabled
                  title="Downstream module - Coming Soon"
                  className="flex items-center gap-2 rounded-cg bg-cg-primary/40 px-3.5 py-2 text-xs font-medium text-cg-muted border border-cg-border opacity-50 cursor-not-allowed"
                >
                  <Sparkles className="h-3.5 w-3.5 text-cg-muted/70" />
                  View Recommendations
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-x-8 xl:grid-cols-2">
              <div>
                <DetailRow label="Country" value={event.country} />
                <DetailRow label="Supplier" value={event.supplier_name || event.affected_supplier} />
                <DetailRow label="Affected product" value={event.affected_product} />
                <DetailRow label="Affected component" value={event.affected_component} />
                <DetailRow label="Risk category" value={event.risk_category} />
                <DetailRow label="Severity" value={event.severity} />
                <DetailRow label="Probability" value={formatPercent(event.probability)} />
              </div>
              <div>
                <DetailRow label="Dynamic risk score" value={formatNumber(event.dynamic_risk_score, { maximumFractionDigits: 2 })} />
                <DetailRow label="Business impact" value={formatNumber(event.business_impact)} />
                <DetailRow label="Mitigation recommendation" value={event.mitigation_recommendation} />
                <DetailRow label="Status" value={event.status} />
                <DetailRow label="Published date" value={formatDate(event.published_date || event.date)} />
                <DetailRow label="Source" value={event.source} />
                <DetailRow label="Related logistics route" value={event.related_logistics_route} />
                <DetailRow label="Affected warehouse" value={event.affected_warehouse} />
              </div>
            </div>

            <div className="mt-6 rounded-cg border border-cg-border p-4">
              <h3 className="text-sm font-semibold text-cg-text">Historical notes</h3>
              <p className="mt-3 text-sm leading-6 text-cg-muted">{event.historical_notes || 'No historical notes available.'}</p>
            </div>
          </>
        )}
      </aside>
    </div>
  )
}
