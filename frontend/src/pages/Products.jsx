import { useCallback, useEffect, useMemo, useState } from 'react'
import { Eye, PackageSearch, RefreshCw, Search, X } from 'lucide-react'
import { getProductById, getProducts, getProductsSummary } from '../api'
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
import { formatNumber, formatPercent } from '../utils/formatters'

const PRODUCT_LIMIT = 500

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
      <span className="text-right text-sm font-medium text-cg-text">{value ?? '—'}</span>
    </div>
  )
}

function ProductDetails({ product, loading, error, onRetry, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Close product details" className="absolute inset-0 bg-cg-primary/20" onClick={onClose} />
      <aside className="relative h-full w-full max-w-2xl overflow-y-auto border-l border-cg-border bg-cg-card p-5 shadow-xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-cg-muted">Product profile</p>
            <h2 className="mt-1 text-xl font-semibold text-cg-text">{product?.model || product?.product_id || 'Product details'}</h2>
            {product?.product_id && <p className="mt-1 text-sm text-cg-muted">{product.product_id}</p>}
          </div>
          <Button size="sm" aria-label="Close product details" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        {loading && <LoadingSpinner label="Loading product details..." />}
        {!loading && error && <ErrorState title="Unable to load product details" message={error} onRetry={onRetry} />}
        {!loading && !error && product && (
          <>
            <div className="mt-5 flex flex-wrap gap-2">
              <RiskBadge level={product.risk?.risk_level} />
              {product.criticality && <RiskBadge level={product.criticality} label={`${product.criticality} criticality`} />}
            </div>

            <div className="mt-5 grid gap-6 xl:grid-cols-2">
              <div>
                <DetailRow label="Category" value={product.category} />
                <DetailRow label="Description" value={product.description} />
                <DetailRow label="Primary supplier" value={product.primary_supplier} />
                <DetailRow label="Country" value={product.primary_supplier_country} />
                <DetailRow label="Criticality" value={product.criticality} />
                <DetailRow label="Risk score" value={formatPercent(product.risk?.risk_score)} />
              </div>
              <div>
                <DetailRow label="Inventory level" value={formatNumber(product.inventory_level)} />
                <DetailRow label="Reorder point" value={formatNumber(product.reorder_point)} />
                <DetailRow label="Lead time" value={product.lead_time_days ? `${product.lead_time_days} days` : null} />
                <DetailRow label="Business impact" value={formatNumber(product.business_impact)} />
                <DetailRow label="Status" value={product.status} />
                <DetailRow label="Notes" value={product.notes} />
              </div>
            </div>

            <div className="mt-6 rounded-cg border border-cg-border p-4">
              <h3 className="text-sm font-semibold text-cg-text">Associated suppliers</h3>
              {product.associated_suppliers?.length ? (
                <div className="mt-3 space-y-3">
                  {product.associated_suppliers.map((supplier) => (
                    <div key={`${supplier.supplier_id}-${supplier.component}`} className="flex flex-wrap items-center justify-between gap-3 rounded-cg bg-cg-hover px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-cg-text">{supplier.supplier_name || supplier.supplier_id}</p>
                        <p className="mt-1 text-xs text-cg-muted">{[supplier.supplier_id, supplier.component, supplier.country].filter(Boolean).join(' · ')}</p>
                      </div>
                      <RiskBadge level={supplier.risk_level} />
                    </div>
                  ))}
                </div>
              ) : <p className="mt-3 text-sm text-cg-muted">No supplier relationships available.</p>}
            </div>
          </>
        )}
      </aside>
    </div>
  )
}

export default function Products() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [criticality, setCriticality] = useState('')
  const [risk, setRisk] = useState('')
  const [sort, setSort] = useState('product_id')
  const [selectedProductId, setSelectedProductId] = useState(null)

  const fetchProducts = useCallback(async () => {
    const [products, summary] = await Promise.all([
      getProducts({
        limit: PRODUCT_LIMIT,
        ...(search.trim() && { search: search.trim() }),
        ...(category && { category }),
        ...(criticality && { criticality }),
        ...(risk && { risk }),
        ...(sort && { sort }),
      }),
      getProductsSummary(),
    ])
    return { products: products.data, summary: summary.data }
  }, [search, category, criticality, risk, sort])
  const { data, loading, error, refetch } = useApi(fetchProducts)
  const products = ensureArray(data?.products).filter((product) => product && typeof product === 'object')
  const summary = data?.summary && typeof data.summary === 'object' ? data.summary : null

  const fetchProductDetails = useCallback(
    () => selectedProductId ? getProductById(selectedProductId) : null,
    [selectedProductId],
  )
  const {
    data: selectedProductData,
    loading: detailLoading,
    error: detailError,
    refetch: refetchDetails,
  } = useApi(fetchProductDetails, [], { immediate: false })
  const selectedProduct = selectedProductData && typeof selectedProductData === 'object' && !Array.isArray(selectedProductData)
    ? selectedProductData
    : null

  useEffect(() => {
    if (selectedProductId) refetchDetails().catch(() => {})
  }, [selectedProductId, refetchDetails])

  const options = useMemo(() => ({
    categories: [...new Set(products.map((product) => product.category).filter(Boolean))].sort(),
    criticalities: [...new Set(products.map((product) => product.criticality).filter(Boolean))].sort(),
    risks: [...new Set(products.map((product) => product.risk?.risk_level).filter(Boolean))].sort(),
  }), [products])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="Monitor products, inventory importance, supplier dependency and operational risk."
      />

      <Card>
        <div className="grid gap-4 xl:grid-cols-6">
          <label className="relative xl:col-span-2"><span className="sr-only">Search products</span><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-cg-muted" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search product name or ID" className="w-full rounded-cg border border-cg-border bg-cg-hover py-2 pl-9 pr-3 text-sm text-cg-text outline-none focus:border-cg-secondary" /></label>
          <select value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-cg border border-cg-border bg-cg-hover px-3 py-2 text-sm text-cg-text"><option value="">All categories</option>{options.categories.map((item) => <option key={item} value={item}>{item}</option>)}</select>
          <select value={criticality} onChange={(event) => setCriticality(event.target.value)} className="rounded-cg border border-cg-border bg-cg-hover px-3 py-2 text-sm text-cg-text"><option value="">All criticality levels</option>{options.criticalities.map((item) => <option key={item} value={item}>{item}</option>)}</select>
          <select value={risk} onChange={(event) => setRisk(event.target.value)} className="rounded-cg border border-cg-border bg-cg-hover px-3 py-2 text-sm text-cg-text"><option value="">All risk levels</option>{options.risks.map((item) => <option key={item} value={item}>{item}</option>)}</select>
          <div className="flex gap-2"><select value={sort} onChange={(event) => setSort(event.target.value)} className="min-w-0 flex-1 rounded-cg border border-cg-border bg-cg-hover px-3 py-2 text-sm text-cg-text"><option value="product_id">Sort: Product ID</option><option value="product_name">Sort: Product</option><option value="category">Sort: Category</option><option value="primary_supplier">Sort: Supplier</option><option value="criticality">Sort: Criticality</option><option value="risk_score">Sort: Risk</option><option value="inventory_level">Sort: Inventory</option></select><Button aria-label="Refresh products" onClick={refetch} disabled={loading}><RefreshCw className="h-4 w-4" /></Button></div>
        </div>
      </Card>

      {!loading && !error && summary && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><SummaryCard label="Total Products" value={formatNumber(summary.total_products)} /><SummaryCard label="Critical Products" value={formatNumber(summary.critical_products)} /><SummaryCard label="Categories" value={formatNumber(summary.total_categories)} /><SummaryCard label="Average Risk" value={formatPercent(summary.average_risk_score)} /></div>}
      {loading && <LoadingSpinner label="Loading products..." />}
      {!loading && error && <ErrorState title="Unable to load products" message={error} onRetry={refetch} />}
      {!loading && !error && products.length === 0 && <EmptyState title="No products found" message="Try changing the search term or removing one or more filters." icon={PackageSearch} />}

      {!loading && !error && products.length > 0 && <Card padding="none" className="overflow-hidden">
        <div className="border-b border-cg-border px-5 py-3"><p className="text-sm text-cg-muted">{formatNumber(products.length)} product records</p></div>
        <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-cg-hover text-xs uppercase tracking-wide text-cg-muted"><tr><th className="px-5 py-3">Product</th><th className="px-5 py-3">Product ID</th><th className="px-5 py-3">Category</th><th className="px-5 py-3">Primary Supplier</th><th className="px-5 py-3">Criticality</th><th className="px-5 py-3">Risk Level</th><th className="px-5 py-3">Inventory</th><th className="px-5 py-3">Reorder Level</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Actions</th></tr></thead><tbody className="divide-y divide-cg-border/70">{products.map((product) => <tr key={product.product_id} className="text-cg-muted"><td className="px-5 py-4 font-medium text-cg-text">{product.model || product.product_id}</td><td className="px-5 py-4">{product.product_id}</td><td className="px-5 py-4">{product.category || '—'}</td><td className="px-5 py-4">{product.primary_supplier || '—'}</td><td className="px-5 py-4">{product.criticality || '—'}</td><td className="px-5 py-4"><RiskBadge level={product.risk?.risk_level} /></td><td className="px-5 py-4">{formatNumber(product.inventory_level)}</td><td className="px-5 py-4">{formatNumber(product.reorder_point)}</td><td className="px-5 py-4">{product.status || '—'}</td><td className="px-5 py-4"><Button size="sm" onClick={() => setSelectedProductId(product.product_id)}><Eye className="h-3.5 w-3.5" />View</Button></td></tr>)}</tbody></table></div>
      </Card>}

      {selectedProductId && <ProductDetails product={selectedProduct} loading={detailLoading} error={detailError} onRetry={refetchDetails} onClose={() => setSelectedProductId(null)} />}
    </div>
  )
}
