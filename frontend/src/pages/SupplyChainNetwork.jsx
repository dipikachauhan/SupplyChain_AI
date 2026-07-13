import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, Factory, Network, RefreshCw, Warehouse } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getNetworkNode, getNetworkOverview } from '../api'
import { Button, Card, EmptyState, ErrorState, LoadingSpinner, PageHeader, RiskBadge } from '../components/common'
import { useApi } from '../hooks/useApi'
import { formatNumber, formatPercent, truncateText } from '../utils/formatters'

const COLORS = { supplier: 'var(--color-cg-primary)', warehouse: 'var(--color-risk-medium)', plant: 'var(--color-cg-secondary)', country: 'var(--color-risk-safe)', product: 'var(--color-cg-chart-series-muted)' }
const PIE = ['var(--color-risk-safe)', 'var(--color-risk-medium)', 'var(--color-risk-high)', 'var(--color-cg-primary)']
const SUPPLIER_LIMIT = 18
const EMPTY_NETWORK = []

function criticalityWeight(value) {
  return ({ critical: 4, high: 3, medium: 2, low: 1 })[String(value || '').toLowerCase()] || 0
}

function focusNetwork(rawNodes, rawEdges) {
  const nodesById = new Map(rawNodes.map(node => [node.id, node]))
  const degree = new Map(rawNodes.map(node => [node.id, 0]))
  rawEdges.forEach(({ source, target }) => {
    degree.set(source, (degree.get(source) || 0) + 1)
    degree.set(target, (degree.get(target) || 0) + 1)
  })

  const suppliers = rawNodes.filter(node => node.type === 'supplier')
    .sort((a, b) => ((degree.get(b.id) || 0) + (b.risk_score || 0) * 10 + criticalityWeight(b.criticality)) - ((degree.get(a.id) || 0) + (a.risk_score || 0) * 10 + criticalityWeight(a.criticality)))
    .slice(0, SUPPLIER_LIMIT)
  const supplierIds = new Set(suppliers.map(node => node.id))
  const relatedIds = (type, predicate, limit) => rawNodes
    .filter(node => node.type === type && rawEdges.some(edge => predicate(edge, node.id)))
    .sort((a, b) => (degree.get(b.id) || 0) - (degree.get(a.id) || 0))
    .slice(0, limit)
    .map(node => node.id)

  // Keep a compact operational path around the most important suppliers instead of every record.
  const productIds = new Set(relatedIds('product', (edge, id) => edge.target === id && supplierIds.has(edge.source), 8))
  const plantIds = new Set(relatedIds('plant', (edge, id) => edge.target === id && productIds.has(edge.source), 4))
  const warehouseIds = new Set(relatedIds('warehouse', (edge, id) => edge.target === id && (supplierIds.has(edge.source) || plantIds.has(edge.source)), 6))
  const visibleIds = new Set([...supplierIds, ...productIds, ...plantIds, ...warehouseIds])

  rawNodes.forEach(node => {
    if (node.type === 'country' && [...visibleIds].some(id => nodesById.get(id)?.country === node.country)) visibleIds.add(node.id)
  })

  const edgeLimits = { located_in: 28, supplies: 22, manufactures: 12, distribution: 8, logistics: 12, supply_relationship: 14 }
  const edgesByRelation = new Map()
  rawEdges.forEach(edge => {
    if (!visibleIds.has(edge.source) || !visibleIds.has(edge.target)) return
    const group = edgesByRelation.get(edge.relation) || []
    group.push(edge)
    edgesByRelation.set(edge.relation, group)
  })
  const edges = [...edgesByRelation.entries()].flatMap(([relation, items]) => items
    .sort((a, b) => ((degree.get(b.source) || 0) + (degree.get(b.target) || 0)) - ((degree.get(a.source) || 0) + (degree.get(a.target) || 0)))
    .slice(0, edgeLimits[relation] || 10))

  return { nodes: rawNodes.filter(node => visibleIds.has(node.id)), edges }
}

const FLOW_LAYERS = [
  ['country', 'Countries'],
  ['supplier', 'Suppliers'],
  ['plant', 'Manufacturing Plants'],
  ['warehouse', 'Warehouses'],
  ['product', 'Products'],
]

function buildFlowConnections(edges) {
  const byRelation = relation => edges.filter(edge => edge.relation === relation)
  const locatedIn = byRelation('located_in')
  const supplies = byRelation('supplies')
  const manufactures = byRelation('manufactures')
  const distribution = byRelation('distribution')
  const connections = new Map()
  const connect = (source, target) => connections.set(source, [...(connections.get(source) || []), target])

  locatedIn.filter(edge => edge.source.startsWith('country:') && edge.target.startsWith('supplier:')).forEach(edge => connect(edge.source, edge.target))
  supplies.forEach(supply => manufactures.filter(flow => flow.source === supply.target).forEach(flow => connect(supply.source, flow.target)))
  distribution.forEach(edge => connect(edge.source, edge.target))
  distribution.forEach(route => manufactures.filter(flow => flow.target === route.source).forEach(flow => connect(route.target, flow.source)))
  return new Map([...connections].map(([source, targets]) => [source, new Set(targets)]))
}

function LayeredSupplyChainFlow({ network, selectedId, onSelect }) {
  const nodesByType = useMemo(() => Object.fromEntries(FLOW_LAYERS.map(([type]) => [type, network.nodes.filter(node => node.type === type)])), [network.nodes])
  const connections = useMemo(() => buildFlowConnections(network.edges), [network.edges])
  const highlightedIds = selectedId ? connections.get(selectedId) || new Set() : new Set()

  return <div className="h-[620px] overflow-y-auto bg-cg-card px-4 py-5 sm:px-6">
    <div className="mx-auto max-w-5xl space-y-3">
      {FLOW_LAYERS.map(([type, title], index) => <div key={type}>
        <section aria-label={title} className="rounded-cg border border-cg-border bg-cg-hover/30 p-3 sm:p-4">
          <div className="mb-3 flex items-center gap-3"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[type] }} /><h3 className="text-xs font-semibold uppercase tracking-wide text-cg-muted">{title}</h3><span className="text-xs text-cg-muted">{nodesByType[type].length}</span></div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {nodesByType[type].map(node => {
              const selected = node.id === selectedId
              const highlighted = highlightedIds.has(node.id)
              return <button key={node.id} type="button" onClick={() => onSelect(node.id)} className={`rounded-cg border bg-cg-card px-3 py-2.5 text-left transition focus:outline-none focus:ring-2 focus:ring-cg-secondary ${selected ? 'border-cg-secondary ring-1 ring-cg-secondary' : highlighted ? 'border-cg-secondary/70 bg-cg-secondary/10' : 'border-cg-border hover:border-cg-secondary/60'}`} style={{ borderLeftColor: COLORS[type], borderLeftWidth: 4 }}>
                <p className="truncate text-sm font-semibold text-cg-text">{node.label}</p>
                <p className="mt-1 text-[10px] uppercase tracking-wide text-cg-muted">{node.risk_level ? `Risk: ${node.risk_level}` : title.slice(0, -1)}</p>
              </button>
            })}
          </div>
        </section>
        {index < FLOW_LAYERS.length - 1 && <div className="flex h-7 flex-col items-center justify-center text-cg-secondary" aria-hidden="true"><span className="h-3 border-l border-cg-secondary/70" /><span className="-mt-1 text-sm leading-none">↓</span></div>}
      </div>)}
    </div>
  </div>
}

function Metric({ label, value, icon: Icon }) { return <Card><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-cg-muted">{label}</p><p className="mt-3 text-3xl font-semibold text-cg-text">{formatNumber(value)}</p></div><Icon className="h-5 w-5 text-cg-secondary" /></div></Card> }
function ChartCard({ title, children }) { return <Card><h3 className="text-sm font-semibold text-cg-text">{title}</h3><div className="mt-4 h-64">{children}</div></Card> }

export default function SupplyChainNetwork() {
  const [country, setCountry] = useState(''); const [supplier, setSupplier] = useState(''); const [product, setProduct] = useState(''); const [risk, setRisk] = useState(''); const [selectedId, setSelectedId] = useState(null)
  const fetchOverview = useCallback(() => getNetworkOverview({ ...(country && { country }), ...(supplier && { supplier_id: supplier }), ...(product && { product_id: product }), ...(risk && { risk_level: risk }) }), [country, supplier, product, risk])
  const { data, loading, error, refetch } = useApi(fetchOverview)
  const rawNodes = Array.isArray(data?.nodes) ? data.nodes : EMPTY_NETWORK; const rawEdges = Array.isArray(data?.edges) ? data.edges : EMPTY_NETWORK
  const focusedNetwork = useMemo(() => focusNetwork(rawNodes, rawEdges), [rawNodes, rawEdges])
  const fetchNode = useCallback(() => selectedId ? getNetworkNode(selectedId) : null, [selectedId]); const { data: detail, loading: detailLoading } = useApi(fetchNode, [], { immediate: false }); useEffect(() => { if (selectedId) fetchNode().catch(() => {}) }, [selectedId, fetchNode])
  const options = useMemo(() => ({ countries: [...new Set(rawNodes.map(n => n.country).filter(Boolean))].sort(), suppliers: rawNodes.filter(n => n.type === 'supplier'), products: rawNodes.filter(n => n.type === 'product') }), [rawNodes])
  const summary = data?.summary || {}; const stats = data?.statistics || {}; const charts = data?.charts || {}
  const topSupplierConnectivity = (charts.supplier_connectivity || []).slice(0, 10).map(item => ({ ...item, name: truncateText(item.name, 18) }))
  const countryRiskExposure = useMemo(() => {
    const grouped = rawNodes.reduce((acc, node) => {
      if (node.type !== 'supplier' || !node.country) return acc
      const bucket = acc.get(node.country) || { name: node.country, score: 0, count: 0 }
      bucket.score += Number(node.risk_score || 0)
      bucket.count += 1
      acc.set(node.country, bucket)
      return acc
    }, new Map())
    return [...grouped.values()]
      .map(item => ({ name: item.name, value: item.count ? Number((item.score / item.count).toFixed(2)) : 0 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [rawNodes])
  return <div className="space-y-6"><PageHeader title="Supply Chain Network" description="Monitor supplier, manufacturing, inventory, and logistics dependencies across the connected supply chain." actions={<Button onClick={refetch} disabled={loading}><RefreshCw className="h-4 w-4" />Refresh</Button>} />
    <Card><div className="grid gap-3 lg:grid-cols-4"><select value={country} onChange={e => setCountry(e.target.value)} className="rounded-cg border border-cg-border bg-cg-hover px-3 py-2 text-sm text-cg-text"><option value="">All countries</option>{options.countries.map(x => <option key={x}>{x}</option>)}</select><select value={supplier} onChange={e => setSupplier(e.target.value)} className="rounded-cg border border-cg-border bg-cg-hover px-3 py-2 text-sm text-cg-text"><option value="">All suppliers</option>{options.suppliers.map(x => <option key={x.supplier_id} value={x.supplier_id}>{x.label}</option>)}</select><select value={product} onChange={e => setProduct(e.target.value)} className="rounded-cg border border-cg-border bg-cg-hover px-3 py-2 text-sm text-cg-text"><option value="">All products</option>{options.products.map(x => <option key={x.product_id} value={x.product_id}>{x.label}</option>)}</select><select value={risk} onChange={e => setRisk(e.target.value)} className="rounded-cg border border-cg-border bg-cg-hover px-3 py-2 text-sm text-cg-text"><option value="">All risk levels</option>{['Low','Medium','High','Critical'].map(x => <option key={x}>{x}</option>)}</select></div></Card>
    {!loading && !error && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6"><Metric label="Total Suppliers" value={summary.total_suppliers} icon={Network}/><Metric label="Manufacturing Plants" value={summary.manufacturing_plants} icon={Factory}/><Metric label="Warehouses" value={summary.warehouses} icon={Warehouse}/><Metric label="Logistics Routes" value={summary.logistics_routes} icon={Network}/><Metric label="Connected Countries" value={summary.connected_countries} icon={BarChart3}/><Metric label="Active Supply Links" value={summary.active_supply_links} icon={Network}/></div>}
    {loading && <LoadingSpinner label="Building supply chain network..."/>}{error && <ErrorState title="Unable to load network" message={error} onRetry={refetch}/>} {!loading && !error && !rawNodes.length && <EmptyState title="No network relationships found" message="Try removing one or more filters." icon={Network}/>} {!loading && !error && rawNodes.length > 0 && <><div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_340px]"><Card padding="none" className="overflow-hidden"><LayeredSupplyChainFlow network={focusedNetwork} selectedId={selectedId} onSelect={setSelectedId}/></Card><Card className="overflow-y-auto"><h2 className="text-base font-semibold text-cg-text">Node details</h2>{!selectedId && <p className="mt-4 text-sm text-cg-muted">Select an item to inspect its operational detail and highlight the next connected layer.</p>}{selectedId && detailLoading && <LoadingSpinner label="Loading details..."/>}{selectedId && !detailLoading && detail?.supplier_id && <div className="mt-4 space-y-4"><div><p className="text-lg font-semibold text-cg-text">{detail.supplier_name || detail.supplier_id}</p><p className="text-sm text-cg-muted">{detail.country} · {detail.component}</p></div><RiskBadge level={detail.risk_score?.risk_level} label={`Risk ${formatPercent(detail.risk_score?.risk_probability)}`}/><div className="space-y-2 text-sm text-cg-muted"><p>Products: {detail.products?.map(x => x.product_id).join(', ') || '—'}</p><p>Inventory: {detail.inventory?.map(x => `${x.warehouse} (${formatNumber(x.current_stock)})`).join(', ') || '—'}</p><p>Routes: {detail.logistics_relationships?.length || 0}</p><p>News events: {detail.recent_news?.length || 0}</p></div><div className="flex gap-2"><Link className="text-sm text-cg-secondary hover:text-cg-text" to={`/suppliers?supplier_id=${detail.supplier_id}`}>View supplier</Link><Link className="text-sm text-cg-secondary hover:text-cg-text" to={`/risk?supplier=${detail.supplier_id}`}>Risk analysis</Link></div></div>}{selectedId && !detailLoading && !detail?.supplier_id && <p className="mt-4 text-sm text-cg-muted">{detail?.message || 'No operational detail for this node.'}</p>}</Card></div>
      <Card><h2 className="text-base font-semibold text-cg-text">Network statistics</h2><div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{[['Most connected supplier',stats.most_connected_supplier?.label],['Highest risk supplier',stats.highest_risk_supplier?.label],['Longest logistics chain',stats.longest_logistics_chain?.route_id && `${stats.longest_logistics_chain.route_id} · ${stats.longest_logistics_chain.transit_time_days} days`],['Most critical node',stats.most_critical_node?.label]].map(([label,value]) => <div key={label} className="rounded-cg border border-cg-border p-4"><p className="text-xs uppercase tracking-wide text-cg-muted">{label}</p><p className="mt-2 font-semibold text-cg-text">{value || '—'}</p></div>)}</div></Card>
      <div className="grid gap-6 xl:grid-cols-3"><ChartCard title="Network health distribution"><ResponsiveContainer><PieChart><Pie data={charts.health} dataKey="value" nameKey="name" outerRadius={75} innerRadius={46}>{(charts.health || []).map((_,i) => <Cell key={i} fill={PIE[i]}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer></ChartCard><ChartCard title="Top supplier connectivity"><ResponsiveContainer><BarChart data={topSupplierConnectivity} layout="vertical" margin={{left:8,right:12}}><XAxis type="number" tick={{fill:'var(--color-cg-chart-axis)',fontSize:11}} tickLine={false}/><YAxis type="category" dataKey="name" width={120} tick={{fill:'var(--color-cg-chart-axis)',fontSize:11}} tickLine={false} axisLine={false}/><Tooltip/><Bar dataKey="value" name="Supply links" fill="var(--color-cg-primary)" radius={[0,4,4,0]}/></BarChart></ResponsiveContainer></ChartCard><ChartCard title="Average supplier risk by country"><ResponsiveContainer><BarChart data={countryRiskExposure} margin={{left:8,right:12}}><CartesianGrid stroke="var(--color-cg-chart-grid)" strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name" tick={{fill:'var(--color-cg-chart-axis)',fontSize:11}} tickLine={false} axisLine={false}/><YAxis tick={{fill:'var(--color-cg-chart-axis)',fontSize:11}} tickLine={false} axisLine={false}/><Tooltip/><Bar dataKey="value" name="Avg risk score" fill="var(--color-risk-medium)" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></ChartCard></div>
      <Card padding="none" className="overflow-hidden"><div className="border-b border-cg-border px-5 py-4"><h2 className="text-base font-semibold text-cg-text">Connected components</h2></div><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-cg-hover text-xs uppercase tracking-wide text-cg-muted"><tr>{['Supplier','Factory','Warehouse','Product','Country','Risk Score','Status'].map(h=><th key={h} className="px-5 py-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-cg-border/70">{(data.components || []).map((row,i)=><tr key={`${row.supplier}-${i}`} className="text-cg-muted"><td className="px-5 py-4 font-medium text-cg-text">{row.supplier}</td><td className="px-5 py-4">{row.factory || '—'}</td><td className="px-5 py-4">{row.warehouse || '—'}</td><td className="px-5 py-4">{row.product || '—'}</td><td className="px-5 py-4">{row.country || '—'}</td><td className="px-5 py-4">{formatPercent(row.risk_score)}</td><td className="px-5 py-4">{row.status || '—'}</td></tr>)}</tbody></table></div></Card></>}</div>
}

