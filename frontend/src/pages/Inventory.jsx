import { useCallback, useEffect, useMemo, useState } from 'react'
import { Eye, PackageSearch, RefreshCw, Search, X } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getInventory, getInventoryItemById, getInventorySummary } from '../api'
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

const INVENTORY_LIMIT = 500

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

function StockStatusBadge({ status }) {
  const level = status === 'Healthy' ? 'Low' : status === 'Low Stock' ? 'Medium' : 'High'
  return <RiskBadge level={level} label={status || 'Unknown'} />
}

function InventoryChart({ items }) {
  const chartData = items.slice(0, 10).map((item) => ({
    item: item.item_id,
    currentStock: item.current_stock || 0,
    reorderLevel: item.reorder_point || 0,
  }))

  return (
    <Card>
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-cg-text">Stock health</h2>
        <p className="mt-1 text-sm text-cg-muted">Current stock compared with reorder levels for the displayed inventory items.</p>
      </div>
      <div className="mt-5 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-cg-chart-grid)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="item" tick={{ fill: 'var(--color-cg-chart-axis)', fontSize: 12 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: 'var(--color-cg-chart-axis)', fontSize: 12 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ background: 'var(--color-cg-card)', border: '1px solid var(--color-cg-border)', borderRadius: '8px' }} labelStyle={{ color: 'var(--color-cg-text)' }} itemStyle={{ color: 'var(--color-cg-text)' }} formatter={(value) => formatNumber(value)} />
            <Legend wrapperStyle={{ color: 'var(--color-cg-muted)', fontSize: 12 }} />
            <Bar dataKey="currentStock" name="Current Stock" fill="var(--color-cg-primary)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="reorderLevel" name="Reorder Level" fill="var(--color-risk-medium)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

function InventoryDetails({ item, loading, error, onRetry, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Close inventory details" className="absolute inset-0 bg-cg-primary/20" onClick={onClose} />
      <aside className="relative h-full w-full max-w-2xl overflow-y-auto border-l border-cg-border bg-cg-card p-5 shadow-xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-cg-muted">Inventory profile</p>
            <h2 className="mt-1 text-xl font-semibold text-cg-text">{item?.item_name || item?.item_id || 'Inventory details'}</h2>
            {item?.item_id && <p className="mt-1 text-sm text-cg-muted">{item.item_id}</p>}
          </div>
          <Button size="sm" aria-label="Close inventory details" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        {loading && <LoadingSpinner label="Loading inventory details..." />}
        {!loading && error && <ErrorState title="Unable to load inventory details" message={error} onRetry={onRetry} />}
        {!loading && !error && item && (
          <>
            <div className="mt-5"><StockStatusBadge status={item.status} /></div>
            <div className="mt-5 grid gap-6 xl:grid-cols-2">
              <div>
                <DetailRow label="Category" value={item.category} />
                <DetailRow label="Warehouse" value={item.warehouse} />
                <DetailRow label="Current stock" value={formatNumber(item.current_stock)} />
                <DetailRow label="Maximum capacity" value={formatNumber(item.maximum_capacity)} />
                <DetailRow label="Reorder point" value={formatNumber(item.reorder_point)} />
                <DetailRow label="Utilization" value={formatPercent(item.utilization)} />
              </div>
              <div>
                <DetailRow label="Associated product" value={item.associated_product ? `${item.associated_product} (${item.associated_product_id})` : null} />
                <DetailRow label="Primary supplier" value={item.primary_supplier} />
                <DetailRow label="Supplier country" value={item.supplier_country} />
                <DetailRow label="Lead time" value={item.lead_time_days ? `${item.lead_time_days} days` : null} />
                <DetailRow label="Recent inventory movement" value={item.recent_inventory_movement} />
                <DetailRow label="Last updated" value={formatDate(item.last_updated)} />
              </div>
            </div>
            <div className="mt-6 rounded-cg border border-cg-border p-4">
              <h3 className="text-sm font-semibold text-cg-text">Business notes</h3>
              <p className="mt-3 text-sm leading-6 text-cg-muted">{item.business_notes || 'No business notes available.'}</p>
            </div>
          </>
        )}
      </aside>
    </div>
  )
}

export default function Inventory() {
  const [search, setSearch] = useState('')
  const [warehouse, setWarehouse] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const [sort, setSort] = useState('item_id')
  const [selectedItemId, setSelectedItemId] = useState(null)

  const fetchInventory = useCallback(async () => {
    const [inventory, summary] = await Promise.all([
      getInventory({
        limit: INVENTORY_LIMIT,
        ...(search.trim() && { search: search.trim() }),
        ...(warehouse && { warehouse }),
        ...(category && { category }),
        ...(status && { status }),
        ...(sort && { sort }),
      }),
      getInventorySummary(),
    ])
    return { inventory: inventory.data, summary: summary.data }
  }, [search, warehouse, category, status, sort])
  const { data, loading, error, refetch } = useApi(fetchInventory)
  const inventory = ensureArray(data?.inventory).filter((item) => item && typeof item === 'object')
  const summary = data?.summary && typeof data.summary === 'object' ? data.summary : null

  const fetchInventoryDetails = useCallback(
    () => selectedItemId ? getInventoryItemById(selectedItemId) : null,
    [selectedItemId],
  )
  const {
    data: selectedItemData,
    loading: detailLoading,
    error: detailError,
    refetch: refetchDetails,
  } = useApi(fetchInventoryDetails, [], { immediate: false })
  const selectedItem = selectedItemData && typeof selectedItemData === 'object' && !Array.isArray(selectedItemData)
    ? selectedItemData
    : null

  useEffect(() => {
    if (selectedItemId) refetchDetails().catch(() => {})
  }, [selectedItemId, refetchDetails])

  const options = useMemo(() => ({
    warehouses: [...new Set(inventory.map((item) => item.warehouse).filter(Boolean))].sort(),
    categories: [...new Set(inventory.map((item) => item.category).filter(Boolean))].sort(),
    statuses: [...new Set(inventory.map((item) => item.status).filter(Boolean))].sort(),
  }), [inventory])

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory" description="Monitor stock levels, warehouse distribution, inventory health and replenishment status." />

      <Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <label className="relative sm:col-span-2 xl:col-span-2"><span className="sr-only">Search inventory</span><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-cg-muted" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search inventory item or ID" className="w-full rounded-cg border border-cg-border bg-cg-hover py-2 pl-9 pr-3 text-sm text-cg-text outline-none focus:border-cg-secondary" /></label>
          <select value={warehouse} onChange={(event) => setWarehouse(event.target.value)} className="min-w-0 rounded-cg border border-cg-border bg-cg-hover px-3 py-2 text-sm text-cg-text"><option value="">All warehouses</option>{options.warehouses.map((item) => <option key={item} value={item}>{item}</option>)}</select>
          <select value={category} onChange={(event) => setCategory(event.target.value)} className="min-w-0 rounded-cg border border-cg-border bg-cg-hover px-3 py-2 text-sm text-cg-text"><option value="">All categories</option>{options.categories.map((item) => <option key={item} value={item}>{item}</option>)}</select>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="min-w-0 rounded-cg border border-cg-border bg-cg-hover px-3 py-2 text-sm text-cg-text"><option value="">All stock statuses</option>{options.statuses.map((item) => <option key={item} value={item}>{item}</option>)}</select>
          <div className="flex min-w-0 gap-2"><select value={sort} onChange={(event) => setSort(event.target.value)} className="min-w-0 flex-1 rounded-cg border border-cg-border bg-cg-hover px-3 py-2 text-sm text-cg-text"><option value="item_id">Sort: Item ID</option><option value="item_name">Sort: Item</option><option value="category">Sort: Category</option><option value="warehouse">Sort: Warehouse</option><option value="current_stock">Sort: Current Stock</option><option value="reorder_point">Sort: Reorder Level</option><option value="utilization">Sort: Utilization</option><option value="status">Sort: Status</option><option value="last_updated">Sort: Last Updated</option></select><Button className="shrink-0" aria-label="Refresh inventory" onClick={refetch} disabled={loading}><RefreshCw className="h-4 w-4" /></Button></div>
        </div>
      </Card>

      {!loading && !error && summary && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><SummaryCard label="Total Inventory Items" value={formatNumber(summary.total_inventory_items)} /><SummaryCard label="Low Stock Items" value={formatNumber(summary.low_stock_items)} /><SummaryCard label="Warehouses" value={formatNumber(summary.total_warehouses)} /><SummaryCard label="Average Utilization" value={formatPercent(summary.average_utilization)} /></div>}
      {loading && <LoadingSpinner label="Loading inventory..." />}
      {!loading && error && <ErrorState title="Unable to load inventory" message={error} onRetry={refetch} />}
      {!loading && !error && inventory.length === 0 && <EmptyState title="No inventory found" message="Try changing the search term or removing one or more filters." icon={PackageSearch} />}

      {!loading && !error && inventory.length > 0 && <><InventoryChart items={inventory} /><Card padding="none" className="overflow-hidden">
        <div className="border-b border-cg-border px-5 py-3"><p className="text-sm text-cg-muted">{formatNumber(inventory.length)} inventory records</p></div>
        <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-cg-hover text-xs uppercase tracking-wide text-cg-muted"><tr><th className="px-5 py-3">Item</th><th className="px-5 py-3">Item ID</th><th className="px-5 py-3">Category</th><th className="px-5 py-3">Warehouse</th><th className="px-5 py-3">Current Stock</th><th className="px-5 py-3">Reorder Level</th><th className="px-5 py-3">Maximum Capacity</th><th className="px-5 py-3">Utilization</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Last Updated</th><th className="px-5 py-3">Actions</th></tr></thead><tbody className="divide-y divide-cg-border/70">{inventory.map((item) => <tr key={item.item_id} className="text-cg-muted"><td className="px-5 py-4 font-medium text-cg-text">{item.item_name || item.item_id}</td><td className="px-5 py-4">{item.item_id}</td><td className="px-5 py-4">{item.category || '—'}</td><td className="px-5 py-4">{item.warehouse || '—'}</td><td className="px-5 py-4">{formatNumber(item.current_stock)}</td><td className="px-5 py-4">{formatNumber(item.reorder_point)}</td><td className="px-5 py-4">{formatNumber(item.maximum_capacity)}</td><td className="px-5 py-4">{formatPercent(item.utilization)}</td><td className="px-5 py-4"><StockStatusBadge status={item.status} /></td><td className="px-5 py-4">{formatDate(item.last_updated)}</td><td className="px-5 py-4"><Button size="sm" onClick={() => setSelectedItemId(item.item_id)}><Eye className="h-3.5 w-3.5" />View</Button></td></tr>)}</tbody></table></div>
      </Card></>}

      {selectedItemId && <InventoryDetails item={selectedItem} loading={detailLoading} error={detailError} onRetry={refetchDetails} onClose={() => setSelectedItemId(null)} />}
    </div>
  )
}
