import { Link } from 'react-router-dom'
import { X, GitBranch, FlaskConical, Sparkles, Truck, ShieldAlert, Activity, CalendarDays, Globe2, Box, FileText } from 'lucide-react'
import { Button, ErrorState, LoadingSpinner, RiskBadge } from '../common'
import { formatDate, formatNumber, formatPercent } from '../../utils/formatters'

function DetailRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-cg-border/70 py-3 last:border-b-0">
      <span className="text-sm text-cg-muted">{label}</span>
      <span className="max-w-[60%] text-right text-sm font-medium text-cg-text">{value ?? '—'}</span>
    </div>
  )
}

function Section({ title, icon: Icon, children }) {
  return (
    <section className="rounded-cg border border-cg-border bg-cg-card p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-cg-secondary" />
        <h3 className="text-sm font-semibold text-cg-text">{title}</h3>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Pill({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border border-cg-border bg-cg-hover px-3 py-1 text-xs font-medium text-cg-text">
      {children}
    </span>
  )
}

export default function NewsDetailsDrawer({ event, loading, error, onRetry, onClose }) {
  const fullDescription =
    event?.summary ||
    (event
      ? `${event.headline || 'This incident'} affects ${event.supplier_name || event.affected_supplier || 'a monitored supplier'} in ${event.country || 'the affected market'}. It is classified as ${event.risk_category || 'an unclassified'} risk event with ${event.severity || 'unknown'} severity.`
      : 'No incident details are available.')

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close news details"
        className="absolute inset-0 bg-cg-primary/20 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside className="relative flex h-full w-full max-w-3xl flex-col overflow-y-auto border-l border-cg-border bg-cg-bg shadow-2xl">
        <div className="border-b border-cg-border bg-cg-card px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-cg-muted">Incident report</p>
              <h2 className="mt-1 truncate text-xl font-semibold text-cg-text sm:text-2xl">{event?.headline || 'News details'}</h2>
              <p className="mt-2 text-sm text-cg-muted">Operational summary for supply chain review and escalation.</p>
            </div>
            <Button size="sm" aria-label="Close news details" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 p-5 sm:p-6">
          {loading && <LoadingSpinner label="Loading news details..." />}

          {!loading && error && <ErrorState title="Unable to load news details" message={error} onRetry={onRetry} />}

          {!loading && !error && event && (
            <div className="space-y-5">
              <div className="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
                <Section title="Incident summary" icon={FileText}>
                  <p className="text-sm leading-6 text-cg-muted">{fullDescription}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Pill>{event.country || 'Global'}</Pill>
                    <Pill>{event.risk_category || 'Unclassified'}</Pill>
                    <Pill>{event.status || 'Open'}</Pill>
                    <Pill>{formatDate(event.published_date || event.date)}</Pill>
                  </div>
                </Section>

                <Section title="Risk snapshot" icon={Activity}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-cg border border-cg-border bg-cg-hover/40 p-3">
                      <p className="text-[10px] uppercase tracking-wide text-cg-muted">Severity</p>
                      <div className="mt-2"><RiskBadge level={event.severity} /></div>
                    </div>
                    <div className="rounded-cg border border-cg-border bg-cg-hover/40 p-3">
                      <p className="text-[10px] uppercase tracking-wide text-cg-muted">Probability</p>
                      <p className="mt-2 text-lg font-semibold text-cg-text">{formatPercent(event.probability)}</p>
                    </div>
                    <div className="rounded-cg border border-cg-border bg-cg-hover/40 p-3">
                      <p className="text-[10px] uppercase tracking-wide text-cg-muted">Risk score</p>
                      <p className="mt-2 text-lg font-semibold text-cg-text">{formatNumber(event.dynamic_risk_score, { maximumFractionDigits: 2 })}</p>
                    </div>
                    <div className="rounded-cg border border-cg-border bg-cg-hover/40 p-3">
                      <p className="text-[10px] uppercase tracking-wide text-cg-muted">Impact</p>
                      <p className="mt-2 text-lg font-semibold text-cg-text">{formatNumber(event.business_impact)}</p>
                    </div>
                  </div>
                </Section>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <Section title="Operational details" icon={Globe2}>
                  <DetailRow label="Country" value={event.country} />
                  <DetailRow label="Supplier" value={event.supplier_name || event.affected_supplier} />
                  <DetailRow label="Affected product" value={event.affected_product} />
                  <DetailRow label="Affected component" value={event.affected_component} />
                  <DetailRow label="Published date" value={formatDate(event.published_date || event.date)} />
                  <DetailRow label="Source" value={event.source} />
                </Section>

                <Section title="Recommended mitigation" icon={ShieldAlert}>
                  <p className="text-sm leading-6 text-cg-muted">{event.mitigation_recommendation || 'No mitigation recommendation available.'}</p>
                  <div className="mt-4 rounded-cg border border-cg-border bg-cg-hover/40 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-cg-muted">Recommended monitoring status</p>
                    <p className="mt-2 text-sm font-medium text-cg-text">{event.recommended_monitoring_status || event.status || 'Open'}</p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      to={`/suppliers?supplier_id=${event.affected_supplier}`}
                      className="flex items-center gap-2 rounded-cg border border-cg-primary bg-cg-primary px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-cg-primary-hover"
                    >
                      <Truck className="h-3.5 w-3.5" />
                      View Supplier
                    </Link>
                    <Link
                      to={`/risk?supplier=${event.affected_supplier}`}
                      className="flex items-center gap-2 rounded-cg border border-cg-primary bg-cg-primary px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-cg-primary-hover"
                    >
                      <ShieldAlert className="h-3.5 w-3.5" />
                      View Risk Analysis
                    </Link>
                    <button
                      disabled
                      title="Downstream module - Coming Soon"
                      className="flex items-center gap-2 rounded-cg border border-cg-border bg-cg-hover/60 px-3.5 py-2 text-xs font-medium text-cg-muted opacity-70 cursor-not-allowed"
                    >
                      <GitBranch className="h-3.5 w-3.5" />
                      Trace Network
                    </button>
                    <button
                      disabled
                      title="Downstream module - Coming Soon"
                      className="flex items-center gap-2 rounded-cg border border-cg-border bg-cg-hover/60 px-3.5 py-2 text-xs font-medium text-cg-muted opacity-70 cursor-not-allowed"
                    >
                      <FlaskConical className="h-3.5 w-3.5" />
                      Simulate Disruption
                    </button>
                    <button
                      disabled
                      title="Downstream module - Coming Soon"
                      className="flex items-center gap-2 rounded-cg border border-cg-border bg-cg-hover/60 px-3.5 py-2 text-xs font-medium text-cg-muted opacity-70 cursor-not-allowed"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      View Recommendations
                    </button>
                  </div>
                </Section>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <Section title="Historical notes" icon={CalendarDays}>
                  <p className="text-sm leading-6 text-cg-muted">{event.historical_notes || 'No historical notes available.'}</p>
                </Section>

                <Section title="Logistics context" icon={Box}>
                  <DetailRow label="Related logistics route" value={event.related_logistics_route} />
                  <DetailRow label="Affected warehouse" value={event.affected_warehouse} />
                </Section>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}

