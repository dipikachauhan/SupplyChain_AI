import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowUpDown, Eye, RefreshCw, Search, Users } from 'lucide-react'
import { getSupplierById, getSuppliers } from '../api'
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingSpinner,
  PageHeader,
  RiskBadge,
} from '../components/common'
import { useApi } from '../hooks/useApi'
import { ensureArray } from '../utils/dashboardMetrics'
import { formatDate, formatNumber, formatPercent } from '../utils/formatters'

const SUPPLIER_LIMIT = 500

function SummaryCard({ label, value }) {
  return (
    <Card>
      <p className="text-sm font-medium text-cg-muted">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-cg-text">{value}</p>
    </Card>
  )
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-cg-border/70 py-3 last:border-b-0">
      <span className="text-sm text-cg-muted">{label}</span>
      <span className="text-right text-sm font-medium text-cg-text">{value || '—'}</span>
    </div>
  )
}

function SupplierDetails({ supplier, loading, error, onRetry }) {
  if (loading) return <LoadingSpinner label="Loading supplier details..." />
  if (error) return <ErrorState title="Unable to load supplier details" message={error} onRetry={onRetry} />
  if (!supplier) return null

  const risk = supplier.risk_score && typeof supplier.risk_score === 'object' ? supplier.risk_score : {}
  const products = ensureArray(supplier.products).filter((item) => item && typeof item === 'object')
  const recentNews = ensureArray(supplier.recent_news).filter((item) => item && typeof item === 'object')
  const logisticsRelationships = ensureArray(supplier.logistics_relationships).filter(
    (item) => item && typeof item === 'object',
  )

  return (
    <Card className="mt-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-cg-muted">Supplier profile</p>
          <h2 className="mt-1 text-xl font-semibold text-cg-text">
            {supplier.supplier_name || supplier.supplier_id}
          </h2>
          <p className="mt-1 text-sm text-cg-muted">{supplier.supplier_id}</p>
        </div>
        <RiskBadge level={risk.risk_level} />
      </div>

      <div className="mt-5 grid gap-6 xl:grid-cols-2">
        <div>
          <DetailRow label="Country" value={supplier.country} />
          <DetailRow label="City" value={supplier.city} />
          <DetailRow label="Component" value={supplier.component} />
          <DetailRow label="Criticality" value={supplier.criticality} />
          <DetailRow label="Status" value={supplier.status} />
        </div>
        <div>
          <DetailRow label="Risk probability" value={formatPercent(risk.risk_probability)} />
          <DetailRow label="Business impact" value={formatNumber(risk.business_impact)} />
          <DetailRow label="Last updated" value={formatDate(risk.last_updated)} />
          <DetailRow label="Lead time" value={supplier.lead_time_days ? `${supplier.lead_time_days} days` : null} />
          <DetailRow label="Transport mode" value={supplier.transport_mode} />
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <div className="rounded-cg border border-cg-border p-4">
          <h3 className="text-sm font-semibold text-cg-text">Products supplied</h3>
          {products.length ? (
            <ul className="mt-3 space-y-2 text-sm text-cg-muted">
              {products.map((item) => <li key={`${item.product_id}-${item.component}`}>{item.product_id} {item.component ? `· ${item.component}` : ''}</li>)}
            </ul>
          ) : <p className="mt-3 text-sm text-cg-muted">No product relationships available.</p>}
        </div>
        <div className="rounded-cg border border-cg-border p-4">
          <h3 className="text-sm font-semibold text-cg-text">Recent news</h3>
          {recentNews.length ? (
            <ul className="mt-3 space-y-3 text-sm text-cg-muted">
              {recentNews.map((item) => (
                <li key={item.id}>
                  <p className="text-cg-text hover:text-cg-secondary transition-colors font-medium">
                    <Link to={`/news?selectedId=${item.id}`}>
                      {item.headline}
                    </Link>
                  </p>
                  <p className="mt-1 text-xs">{formatDate(item.date)}</p>
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-sm text-cg-muted">No recent news available.</p>}
        </div>
        <div className="rounded-cg border border-cg-border p-4">
          <h3 className="text-sm font-semibold text-cg-text">Logistics relationships</h3>
          {logisticsRelationships.length ? (
            <ul className="mt-3 space-y-2 text-sm text-cg-muted">
              {logisticsRelationships.map((item) => <li key={item.route_id}>{item.origin_country || '—'} → {item.destination_country || '—'} · {item.transport_method || '—'}</li>)}
            </ul>
          ) : <p className="mt-3 text-sm text-cg-muted">No logistics relationships available.</p>}
        </div>
      </div>
    </Card>
  )
}

export default function Suppliers() {
  const [searchParams, setSearchParams] = useSearchParams()
  const querySupplierId = searchParams.get('supplier_id') || searchParams.get('selectedSupplierId')

  const [search, setSearch] = useState('')
  const [country, setCountry] = useState('')
  const [riskLevel, setRiskLevel] = useState('')
  const [criticality, setCriticality] = useState('')
  const [sortBy, setSortBy] = useState('supplier_name')
  const [localSelectedSupplierId, setLocalSelectedSupplierId] = useState(null)

  const selectedSupplierId = querySupplierId || localSelectedSupplierId

  const setSelectedSupplierId = (id) => {
    const params = {}
    if (search.trim()) params.q = search.trim()
    if (country) params.country = country
    if (riskLevel) params.risk_level = riskLevel
    if (criticality) params.criticality = criticality
    if (id) {
      params.supplier_id = id
    }
    setSearchParams(params)
    setLocalSelectedSupplierId(id)
  }

  const fetchSuppliers = useCallback(
    () => getSuppliers({
      limit: SUPPLIER_LIMIT,
      ...(search.trim() && { q: search.trim() }),
      ...(country && { country }),
      ...(riskLevel && { risk_level: riskLevel }),
      ...(criticality && { criticality }),
    }),
    [search, country, riskLevel, criticality],
  )
  const { data: supplierData, loading, error, refetch } = useApi(fetchSuppliers)
  const suppliers = ensureArray(supplierData).filter(
    (supplier) => supplier && typeof supplier === 'object',
  )

  const fetchSupplierDetails = useCallback(
    () => selectedSupplierId ? getSupplierById(selectedSupplierId) : null,
    [selectedSupplierId],
  )
  const {
    data: selectedSupplierData,
    loading: detailLoading,
    error: detailError,
    refetch: refetchDetails,
  } = useApi(fetchSupplierDetails, [], { immediate: false })
  const selectedSupplier =
    selectedSupplierData &&
    typeof selectedSupplierData === 'object' &&
    !Array.isArray(selectedSupplierData)
      ? selectedSupplierData
      : null

  useEffect(() => {
    if (selectedSupplierId) refetchDetails().catch(() => {})
  }, [selectedSupplierId, refetchDetails])

  const options = useMemo(() => ({
    countries: [...new Set(suppliers.map((supplier) => supplier.country).filter(Boolean))].sort(),
    riskLevels: [...new Set(suppliers.map((supplier) => supplier.risk_score?.risk_level).filter(Boolean))].sort(),
    criticalityLevels: [...new Set(suppliers.map((supplier) => supplier.criticality).filter(Boolean))].sort(),
  }), [suppliers])

  const sortedSuppliers = useMemo(() => [...suppliers].sort((a, b) => {
    if (sortBy === 'risk_probability') return (b.risk_score?.risk_probability || 0) - (a.risk_score?.risk_probability || 0)
    return String(a[sortBy] || '').localeCompare(String(b[sortBy] || ''))
  }), [suppliers, sortBy])

  const summary = useMemo(() => {
    const probabilities = suppliers.map((supplier) => supplier.risk_score?.risk_probability).filter((value) => Number.isFinite(value))
    return {
      total: suppliers.length,
      highRisk: suppliers.filter((supplier) => String(supplier.risk_score?.risk_level).toLowerCase() === 'high').length,
      countries: new Set(suppliers.map((supplier) => supplier.country).filter(Boolean)).size,
      averageRisk: probabilities.length ? probabilities.reduce((sum, value) => sum + value, 0) / probabilities.length : null,
    }
  }, [suppliers])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suppliers"
        description="Monitor supplier performance, criticality, geographic exposure, and risk indicators across the network."
        actions={<Button onClick={refetch} disabled={loading}><RefreshCw className="h-4 w-4" />Refresh</Button>}
      />

      <Card>
        <div className="grid gap-4 lg:grid-cols-4">
          <label className="relative lg:col-span-1"><span className="sr-only">Search suppliers</span><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-cg-muted" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, ID, or country" className="w-full rounded-cg border border-cg-border bg-cg-hover py-2 pl-9 pr-3 text-sm text-cg-text outline-none focus:border-cg-secondary" /></label>
          <select value={country} onChange={(event) => setCountry(event.target.value)} className="rounded-cg border border-cg-border bg-cg-hover px-3 py-2 text-sm text-cg-text"><option value="">All countries</option>{options.countries.map((item) => <option key={item} value={item}>{item}</option>)}</select>
          <select value={riskLevel} onChange={(event) => setRiskLevel(event.target.value)} className="rounded-cg border border-cg-border bg-cg-hover px-3 py-2 text-sm text-cg-text"><option value="">All risk levels</option>{options.riskLevels.map((item) => <option key={item} value={item}>{item}</option>)}</select>
          <select value={criticality} onChange={(event) => setCriticality(event.target.value)} className="rounded-cg border border-cg-border bg-cg-hover px-3 py-2 text-sm text-cg-text"><option value="">All criticality levels</option>{options.criticalityLevels.map((item) => <option key={item} value={item}>{item}</option>)}</select>
        </div>
      </Card>

      {!loading && !error && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><SummaryCard label="Total Suppliers" value={formatNumber(summary.total)} /><SummaryCard label="High Risk Suppliers" value={formatNumber(summary.highRisk)} /><SummaryCard label="Countries Represented" value={formatNumber(summary.countries)} /><SummaryCard label="Average Risk Score" value={formatPercent(summary.averageRisk)} /></div>}
      {loading && <LoadingSpinner label="Loading suppliers..." />}
      {!loading && error && <ErrorState title="Unable to load suppliers" message={error} onRetry={refetch} />}
      {!loading && !error && suppliers.length === 0 && <EmptyState title="No suppliers found" message="Try changing the search term or removing one or more filters." icon={Users} />}

      {!loading && !error && suppliers.length > 0 && <Card padding="none" className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-cg-border px-5 py-3"><p className="text-sm text-cg-muted">{formatNumber(suppliers.length)} supplier records</p><label className="flex items-center gap-2 text-sm text-cg-muted"><ArrowUpDown className="h-4 w-4" />Sort<select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="rounded-cg border border-cg-border bg-cg-hover px-2 py-1 text-cg-text"><option value="supplier_name">Name</option><option value="country">Country</option><option value="criticality">Criticality</option><option value="risk_probability">Risk probability</option></select></label></div>
        <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-cg-hover text-xs uppercase tracking-wide text-cg-muted"><tr><th className="px-5 py-3">Supplier</th><th className="px-5 py-3">Country</th><th className="px-5 py-3">Component</th><th className="px-5 py-3">Criticality</th><th className="px-5 py-3">Risk level</th><th className="px-5 py-3">Risk probability</th><th className="px-5 py-3">Business impact</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Actions</th></tr></thead><tbody className="divide-y divide-cg-border/70">{sortedSuppliers.map((supplier) => <tr key={supplier.supplier_id} className="text-cg-muted"><td className="px-5 py-4"><p className="font-medium text-cg-text">{supplier.supplier_name || supplier.supplier_id}</p><p className="mt-1 text-xs">{supplier.supplier_id}</p></td><td className="px-5 py-4">{supplier.country || '—'}</td><td className="px-5 py-4">{supplier.component || '—'}</td><td className="px-5 py-4">{supplier.criticality || '—'}</td><td className="px-5 py-4"><RiskBadge level={supplier.risk_score?.risk_level} /></td><td className="px-5 py-4">{formatPercent(supplier.risk_score?.risk_probability)}</td><td className="px-5 py-4">{formatNumber(supplier.risk_score?.business_impact)}</td><td className="px-5 py-4">{supplier.status || '—'}</td><td className="px-5 py-4"><Button size="sm" onClick={() => setSelectedSupplierId(supplier.supplier_id)}><Eye className="h-3.5 w-3.5" />View</Button></td></tr>)}</tbody></table></div>
      </Card>}
      {selectedSupplierId && <SupplierDetails supplier={selectedSupplier} loading={detailLoading} error={detailError} onRetry={refetchDetails} />}
    </div>
  )
}
