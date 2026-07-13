import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Boxes, GitBranch, ShieldAlert, Truck, X } from 'lucide-react'
import { Button, ErrorState, LoadingSpinner, RiskBadge } from '../common'
import { formatDate, formatNumber, formatPercent } from '../../utils/formatters'
import { ensureArray } from '../../utils/dashboardMetrics'

function DetailRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-cg-border/70 py-3 last:border-b-0">
      <span className="text-sm text-cg-muted">{label}</span>
      <span className="max-w-[60%] text-right text-sm font-medium text-cg-text">{value ?? '-'}</span>
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

export default function SupplierDetailsDrawer({ supplier, loading, error, onRetry, onClose }) {
  const risk = supplier?.risk_score && typeof supplier.risk_score === 'object' ? supplier.risk_score : {}
  const products = ensureArray(supplier?.products).filter((item) => item && typeof item === 'object')
  const recentNews = ensureArray(supplier?.recent_news).filter((item) => item && typeof item === 'object')
  const logisticsRelationships = ensureArray(supplier?.logistics_relationships).filter((item) => item && typeof item === 'object')
  const supplierRelationships = ensureArray(supplier?.supplier_relationships).filter((item) => item && typeof item === 'object')

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close supplier details"
        className="absolute inset-0 bg-cg-primary/20 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside className="relative flex h-full w-full max-w-3xl flex-col overflow-y-auto border-l border-cg-border bg-cg-bg shadow-2xl">
        <div className="border-b border-cg-border bg-cg-card px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-cg-muted">Supplier profile</p>
              <h2 className="mt-1 truncate text-xl font-semibold text-cg-text sm:text-2xl">
                {supplier?.supplier_name || supplier?.supplier_id || 'Supplier details'}
              </h2>
              <p className="mt-2 text-sm text-cg-muted">Operational summary for supplier review and escalation.</p>
            </div>
            <Button size="sm" aria-label="Close supplier details" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 p-5 sm:p-6">
          {loading && <LoadingSpinner label="Loading supplier details..." />}

          {!loading && error && <ErrorState title="Unable to load supplier details" message={error} onRetry={onRetry} />}

          {!loading && !error && supplier && (
            <div className="space-y-5">
              <div className="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
                <Section title="Supplier summary" icon={Boxes}>
                  <p className="text-sm leading-6 text-cg-muted">
                    {supplier.supplier_name || supplier.supplier_id} is monitored as a {supplier.criticality || '-'} critical supplier in {supplier.country || 'an unspecified'} market.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Pill>{supplier.supplier_id}</Pill>
                    <Pill>{supplier.country || 'Global'}</Pill>
                    <Pill>{supplier.city || 'No city specified'}</Pill>
                    <Pill>{supplier.component || 'Unspecified component'}</Pill>
                    <Pill>{supplier.status || 'Open'}</Pill>
                  </div>
                </Section>

                <Section title="Risk snapshot" icon={ShieldAlert}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-cg border border-cg-border bg-cg-hover/40 p-3">
                      <p className="text-[10px] uppercase tracking-wide text-cg-muted">Risk level</p>
                      <div className="mt-2">
                        <RiskBadge level={risk.risk_level} />
                      </div>
                    </div>
                    <div className="rounded-cg border border-cg-border bg-cg-hover/40 p-3">
                      <p className="text-[10px] uppercase tracking-wide text-cg-muted">Probability</p>
                      <p className="mt-2 text-lg font-semibold text-cg-text">{formatPercent(risk.risk_probability)}</p>
                    </div>
                    <div className="rounded-cg border border-cg-border bg-cg-hover/40 p-3">
                      <p className="text-[10px] uppercase tracking-wide text-cg-muted">Business impact</p>
                      <p className="mt-2 text-lg font-semibold text-cg-text">{formatNumber(risk.business_impact)}</p>
                    </div>
                    <div className="rounded-cg border border-cg-border bg-cg-hover/40 p-3">
                      <p className="text-[10px] uppercase tracking-wide text-cg-muted">Last updated</p>
                      <p className="mt-2 text-sm font-semibold text-cg-text">{formatDate(risk.last_updated)}</p>
                    </div>
                  </div>
                </Section>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <Section title="Operational details" icon={Truck}>
                  <DetailRow label="Supplier name" value={supplier.supplier_name} />
                  <DetailRow label="Supplier ID" value={supplier.supplier_id} />
                  <DetailRow label="Country" value={supplier.country} />
                  <DetailRow label="City" value={supplier.city} />
                  <DetailRow label="Component" value={supplier.component} />
                  <DetailRow label="Criticality" value={supplier.criticality} />
                  <DetailRow label="Status" value={supplier.status} />
                  <DetailRow label="Lead time" value={supplier.lead_time_days ? `${supplier.lead_time_days} days` : null} />
                  <DetailRow label="Transport mode" value={supplier.transport_mode} />
                </Section>

                <Section title="Risk and capacity" icon={ShieldAlert}>
                  <DetailRow label="Risk probability" value={formatPercent(risk.risk_probability)} />
                  <DetailRow label="Business impact" value={formatNumber(risk.business_impact)} />
                  <DetailRow label="Risk badge" value={<RiskBadge level={risk.risk_level} />} />
                  <DetailRow label="Capacity" value={formatNumber(supplier.capacity)} />
                  <DetailRow label="Inventory buffer" value={formatNumber(supplier.inventory_buffer)} />
                  <DetailRow label="Last updated" value={formatDate(risk.last_updated)} />
                  <DetailRow label="Backup supplier" value={supplier.backup_supplier} />
                </Section>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <Section title="Products supplied" icon={Boxes}>
                  {products.length ? (
                    <ul className="space-y-2 text-sm text-cg-muted">
                      {products.map((item) => (
                        <li key={`${item.product_id}-${item.component || 'component'}`}>
                          <span className="font-medium text-cg-text">{item.product_id}</span>
                          {item.component ? <span>{` · ${item.component}`}</span> : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-cg-muted">No product relationships available.</p>
                  )}
                </Section>

                <Section title="Recent news" icon={ShieldAlert}>
                  {recentNews.length ? (
                    <ul className="space-y-3 text-sm text-cg-muted">
                      {recentNews.map((item) => (
                        <li key={item.id}>
                          <p className="font-medium text-cg-text transition-colors hover:text-cg-secondary">
                            <Link to={`/news?selectedId=${item.id}`}>
                              {item.headline || `News item ${item.id}`}
                            </Link>
                          </p>
                          <p className="mt-1 text-xs">{formatDate(item.date)}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-cg-muted">No recent news available.</p>
                  )}
                </Section>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <Section title="Logistics relationships" icon={Truck}>
                  {logisticsRelationships.length ? (
                    <ul className="space-y-2 text-sm text-cg-muted">
                      {logisticsRelationships.map((item) => (
                        <li key={item.route_id}>
                          {item.origin_country || '-'} {'->'} {item.destination_country || '-'} {'-'} {item.transport_method || '-'}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-cg-muted">No logistics relationships available.</p>
                  )}
                </Section>

                <Section title="Supplier relationships" icon={GitBranch}>
                  {supplierRelationships.length ? (
                    <ul className="space-y-2 text-sm text-cg-muted">
                      {supplierRelationships.map((item, index) => (
                        <li key={`${item.source_supplier}-${item.target_supplier}-${index}`}>
                          {item.source_supplier} {'->'} {item.target_supplier} {'-'} {item.dependency_strength || 'Linked'}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-cg-muted">No supplier relationships available.</p>
                  )}
                </Section>
              </div>

              <Section title="Quick Actions" icon={ShieldAlert}>
                <div className="flex flex-wrap gap-2">
                  <Link
                    to={`/risk?supplier=${supplier.supplier_id}`}
                    className="flex items-center gap-2 rounded-cg border border-cg-primary bg-cg-primary px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-cg-primary-hover"
                  >
                    <ShieldAlert className="h-3.5 w-3.5" />
                    View Risk Analysis
                  </Link>
                  <Link
                    to={`/inventory?supplier_id=${supplier.supplier_id}`}
                    className="flex items-center gap-2 rounded-cg border border-cg-primary bg-cg-primary px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-cg-primary-hover"
                  >
                    <Boxes className="h-3.5 w-3.5" />
                    View Inventory
                  </Link>
                  <Link
                    to={`/network?supplier_id=${supplier.supplier_id}`}
                    className="flex items-center gap-2 rounded-cg border border-cg-primary bg-cg-primary px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-cg-primary-hover"
                  >
                    <GitBranch className="h-3.5 w-3.5" />
                    View Supply Network
                  </Link>
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-cg border border-cg-border bg-cg-hover px-3.5 py-2 text-xs font-medium text-cg-text transition-colors hover:bg-cg-hover/80"
                    onClick={onClose}
                  >
                    <X className="h-3.5 w-3.5" />
                    Close
                  </button>
                </div>
              </Section>
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}
