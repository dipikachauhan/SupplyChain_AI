import { useCallback, useMemo, useState } from 'react'
import { AlertTriangle, ArrowRightLeft, BadgeInfo, BarChart3, Clock3, Factory, RefreshCw, ShieldCheck, Sparkles, Truck } from 'lucide-react'
import { generateAIRecommendation, getSuppliers } from '../api'
import { Button, Card, EmptyState, ErrorState, LoadingSpinner, PageHeader } from '../components/common'
import { useApi } from '../hooks/useApi'
import { formatNumber } from '../utils/formatters'

function Metric({ label, value, icon: Icon }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-cg-muted">{label}</p>
          <p className="mt-3 text-3xl font-semibold text-cg-text">{value ?? '—'}</p>
        </div>
        <Icon className="h-5 w-5 text-cg-secondary" />
      </div>
    </Card>
  )
}

function SectionCard({ title, icon: Icon, children, className = '' }) {
  return (
    <Card className={className}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-cg-secondary" />
        <h2 className="text-sm font-semibold text-cg-text">{title}</h2>
      </div>
      <div className="mt-4">{children}</div>
    </Card>
  )
}

function BulletList({ items, emptyLabel = 'No data available.' }) {
  if (!items?.length) {
    return <p className="text-sm text-cg-muted">{emptyLabel}</p>
  }
  return (
    <ul className="space-y-2 text-sm leading-6 text-cg-muted">
      {items.map(item => (
        <li key={item} className="rounded-cg border border-cg-border bg-cg-hover/40 px-3 py-2">
          {item}
        </li>
      ))}
    </ul>
  )
}

function AlternateSupplierCard({ supplier }) {
  return (
    <div className="rounded-cg border border-cg-border bg-cg-hover/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-cg-text">{supplier.supplier_name}</p>
          <p className="text-xs text-cg-muted">{supplier.country || 'Unknown country'}</p>
        </div>
        <span className="rounded-full border border-cg-border px-2 py-1 text-xs text-cg-secondary">{supplier.risk_level || 'Unknown risk'}</span>
      </div>
      <div className="mt-3 grid gap-2 text-sm text-cg-muted sm:grid-cols-2">
        <p><span className="text-cg-text">Component:</span> {supplier.component || '—'}</p>
        <p><span className="text-cg-text">Criticality:</span> {supplier.criticality || '—'}</p>
        <p><span className="text-cg-text">Risk probability:</span> {supplier.risk_probability != null ? `${formatNumber(supplier.risk_probability, { maximumFractionDigits: 1 })}%` : '—'}</p>
        <p><span className="text-cg-text">Business impact:</span> {supplier.business_impact != null ? formatNumber(supplier.business_impact, { maximumFractionDigits: 1 }) : '—'}</p>
        <p><span className="text-cg-text">Lead time:</span> {supplier.lead_time || (supplier.lead_time_days != null ? `${formatNumber(supplier.lead_time_days, { maximumFractionDigits: 0 })} days` : '—')}</p>
        <p><span className="text-cg-text">Capacity:</span> {supplier.capacity != null ? formatNumber(supplier.capacity, { maximumFractionDigits: 0 }) : '—'}</p>
        <p><span className="text-cg-text">Compatibility:</span> {supplier.compatibility_score != null ? `${formatNumber(supplier.compatibility_score, { maximumFractionDigits: 0 })}%` : '—'}</p>
      </div>
      <p className="mt-3 text-sm leading-6 text-cg-muted">{supplier.reason || 'Lowest operational risk and compatible component coverage.'}</p>
    </div>
  )
}

export default function AIRecommendations() {
  const [supplierId, setSupplierId] = useState('')
  const [recommendation, setRecommendation] = useState(null)
  const [context, setContext] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [generationError, setGenerationError] = useState(null)

  const fetchSuppliers = useCallback(() => getSuppliers({ limit: 500 }), [])
  const { data: suppliers = [] } = useApi(fetchSuppliers)

  const supplierList = useMemo(
    () => (Array.isArray(suppliers) ? suppliers.filter(Boolean) : []),
    [suppliers],
  )

  const selectedSupplier = useMemo(
    () => supplierList.find(item => item.supplier_id === supplierId) || null,
    [supplierId, supplierList],
  )

  const generate = async () => {
    if (!supplierId) {
      setGenerationError('Please choose a supplier before generating a mitigation strategy.')
      return
    }

    setGenerating(true)
    setGenerationError(null)
    try {
      const response = await generateAIRecommendation({ supplier_id: supplierId })
      setRecommendation(response.data.recommendation)
      setContext(response.data.context)
    } catch (error) {
      setRecommendation(null)
      setContext(null)
      setGenerationError(error.message || 'Unable to generate a mitigation strategy.')
    } finally {
      setGenerating(false)
    }
  }

  const kpis = context?.kpis || {}
  const alternateSuppliers = recommendation?.alternateSuppliers || context?.alternateSuppliers || []
  const summarySupplier = recommendation?.contextSummary?.supplier || selectedSupplier

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Mitigation Strategy Generator"
        description="Generate enterprise mitigation strategies from supplier, product, inventory, risk, news, and network context."
        actions={(
          <Button onClick={generate} disabled={generating || !supplierId}>
            {generating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {generating ? 'Generating…' : 'Generate Mitigation Strategy'}
          </Button>
        )}
      />

      <Card>
        <div className="grid gap-3 lg:grid-cols-[1.5fr_0.75fr]">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-cg-muted">Primary supplier</label>
            <select
              value={supplierId}
              onChange={event => setSupplierId(event.target.value)}
              className="w-full rounded-cg border border-cg-border bg-cg-hover px-3 py-2 text-sm text-cg-text"
            >
              <option value="">Select a supplier</option>
              {supplierList.map(item => (
                <option key={item.supplier_id} value={item.supplier_id}>
                  {item.supplier_name || item.supplier_id}
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-cg border border-cg-border bg-cg-hover/40 p-4 text-sm text-cg-muted">
            <p className="font-semibold text-cg-text">Supplier-first workflow</p>
            <p className="mt-2 leading-6">
              Select one supplier and the backend will automatically combine products, inventory, risk, news, logistics, and network data into a mitigation strategy.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Monitored Suppliers" value={context ? formatNumber(kpis.monitored_suppliers) : null} icon={Factory} />
        <Metric label="High Risk Suppliers" value={context ? formatNumber(kpis.high_risk_suppliers) : null} icon={AlertTriangle} />
        <Metric label="Active News Events" value={context ? formatNumber(kpis.active_news_events) : null} icon={BadgeInfo} />
        <Metric label="Inventory Alerts" value={context ? formatNumber(kpis.inventory_alerts) : null} icon={ShieldCheck} />
      </div>

      {generating && <LoadingSpinner label="Analyzing supply-chain context..." />}
      {!generating && generationError && <ErrorState title="Unable to generate mitigation strategy" message={generationError} onRetry={generate} />}
      {!generating && !generationError && !recommendation && (
        <EmptyState
          title="No mitigation strategy generated"
          message="Choose a supplier, then generate a strategy from the current operational data."
          icon={Sparkles}
        />
      )}

      {!generating && !generationError && recommendation && (
        <div className="space-y-6">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-5xl">
                <p className="text-xs font-semibold uppercase tracking-wide text-cg-muted">Executive summary</p>
                <p className="mt-2 text-base leading-7 text-cg-text">{recommendation.executiveSummary}</p>
              </div>
              <div className="rounded-cg border border-cg-border px-4 py-3 text-right">
                <p className="text-[10px] uppercase tracking-wide text-cg-muted">AI confidence</p>
                <p className="text-2xl font-semibold text-cg-text">{formatNumber(recommendation.confidence, { maximumFractionDigits: 0 })}%</p>
                <p className="mt-1 text-xs text-cg-muted">{recommendation.overallRisk || 'Medium'} overall risk</p>
              </div>
            </div>
            {summarySupplier && (
              <div className="mt-4 rounded-cg border border-cg-border bg-cg-hover/40 px-4 py-3 text-sm text-cg-muted">
                <p className="font-semibold text-cg-text">{summarySupplier.supplier_name || summarySupplier.supplier_id}</p>
                <p className="mt-1">Country: {summarySupplier.country || '—'} | Component: {summarySupplier.component || '—'} | Criticality: {summarySupplier.criticality || '—'}</p>
              </div>
            )}
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            <SectionCard title="Immediate Actions (0-7 Days)" icon={Clock3}>
              <BulletList items={recommendation.immediateActions} emptyLabel="No immediate actions available." />
            </SectionCard>
            <SectionCard title="Inventory Strategy" icon={BarChart3}>
              <BulletList items={recommendation.inventoryStrategy} emptyLabel="No inventory strategy available." />
            </SectionCard>
            <SectionCard title="Supplier Strategy" icon={ArrowRightLeft}>
              <BulletList items={recommendation.supplierStrategy} emptyLabel="No supplier strategy available." />
            </SectionCard>
            <SectionCard title="Logistics Strategy" icon={Truck}>
              <BulletList items={recommendation.logisticsStrategy} emptyLabel="No logistics strategy available." />
            </SectionCard>
          </div>

          <SectionCard title="Alternate Supplier Recommendations" icon={Factory}>
            {alternateSuppliers.length ? (
              <div className="grid gap-3 xl:grid-cols-2">
                {alternateSuppliers.map(supplier => (
                  <AlternateSupplierCard key={supplier.supplier_id} supplier={supplier} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-cg-muted">No alternate suppliers were found for this component.</p>
            )}
          </SectionCard>

          <div className="grid gap-6 xl:grid-cols-2">
            <SectionCard title="Long-Term Strategy" icon={ShieldCheck}>
              <BulletList items={recommendation.longTermStrategy} emptyLabel="No long-term strategy available." />
            </SectionCard>
            <SectionCard title="Expected Business Impact" icon={BadgeInfo}>
              <p className="text-sm leading-7 text-cg-muted">{recommendation.expectedBusinessImpact}</p>
            </SectionCard>
          </div>

          {recommendation.contextSummary?.products?.length ? (
            <SectionCard title="Affected Products" icon={Factory}>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {recommendation.contextSummary.products.map(product => (
                  <div key={`${product.product_id}-${product.component}`} className="rounded-cg border border-cg-border bg-cg-hover/40 p-3 text-sm text-cg-muted">
                    <p className="font-semibold text-cg-text">{product.model || product.product_id}</p>
                    <p className="mt-1">Component: {product.component || '—'}</p>
                    <p>Category: {product.segment || '—'}</p>
                    <p>Inventory: {product.current_inventory != null ? `${formatNumber(product.current_inventory, { maximumFractionDigits: 0 })} units` : '—'}</p>
                    <p>Criticality: {product.criticality || '—'}</p>
                    <p>Supplier Dependency: {product.supplier_dependency != null ? `${formatNumber(product.supplier_dependency, { maximumFractionDigits: 0 })}%` : '—'}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          ) : null}
        </div>
      )}
    </div>
  )
}
