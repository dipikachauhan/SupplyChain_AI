import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Boxes, Clock3, DollarSign, Factory, ListChecks, Play, ShieldCheck, Truck } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getSuppliers, runSimulation } from '../api'
import { Button, Card, EmptyState, ErrorState, LoadingSpinner, PageHeader } from '../components/common'
import { useApi } from '../hooks/useApi'
import { formatNumber } from '../utils/formatters'

const tooltipStyle = {
  backgroundColor: 'var(--color-cg-card)',
  border: '1px solid var(--color-cg-border)',
  borderRadius: '8px',
  color: 'var(--color-cg-text)',
}

function Metric({ label, value, suffix = '', icon: Icon, tone }) {
  return (
    <Card className={`border-l-2 ${tone.border}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-cg-muted">{label}</p>
          <p className="mt-3 text-3xl font-semibold text-cg-text">
            {value === null || value === undefined ? '—' : `${formatNumber(value, { maximumFractionDigits: 1 })}${suffix}`}
          </p>
        </div>
        <div className={`rounded-cg p-2 ${tone.background}`}><Icon className={`h-5 w-5 ${tone.icon}`} /></div>
      </div>
    </Card>
  )
}

function SliderControl({ label, value, max, suffix, onChange }) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-cg-text">{label}</span>
        <span className="text-sm text-cg-secondary">{value}{suffix}</span>
      </div>
      <input type="range" min="0" max={max} value={value} onChange={event => onChange(Number(event.target.value))} className="h-2 w-full cursor-pointer accent-cg-secondary" />
    </label>
  )
}

function RecommendedResponse({ result }) {
  const { kpis = {}, recommended_backup_supplier: backup } = result
  const priority = kpis.overall_risk_score >= 80 ? 'Critical' : kpis.overall_risk_score >= 60 ? 'High' : 'Medium'
  const immediateActions = [
    'Escalate the disruption to supply-chain operations and protect open customer commitments.',
    backup ? `Initiate qualification and allocation with ${backup.supplier_name}.` : 'Identify and qualify a linked alternate supplier.',
    kpis.service_level < 80
      ? 'Reallocate available inventory to the affected warehouses and highest-priority products.'
      : 'Monitor inventory buffers and preserve safety stock while the supplier recovers.',
  ]

  return (
    <Card>
      <div className="flex items-center gap-2">
        <ListChecks className="h-4 w-4 text-cg-secondary" />
        <h2 className="text-base font-semibold text-cg-text">Recommended response</h2>
      </div>
      <div className="mt-4 grid gap-5 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-cg-muted">Immediate actions</p>
          <ul className="mt-2 space-y-2 text-sm leading-6 text-cg-text">
            {immediateActions.map(action => <li key={action} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cg-secondary" />{action}</li>)}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-cg-muted">Backup supplier</p>
          <p className="mt-2 text-sm font-semibold text-cg-text">{backup?.supplier_name || 'No linked backup supplier'}</p>
          {backup?.country && <p className="mt-1 text-sm text-cg-muted">{backup.country}</p>}
          <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-cg-muted">Priority level</p>
          <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${priority === 'Critical' ? 'bg-red-500/15 text-red-300' : priority === 'High' ? 'bg-orange-500/15 text-orange-300' : 'bg-yellow-500/15 text-yellow-300'}`}>{priority}</span>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-cg-muted">Estimated recovery strategy</p>
          <p className="mt-2 text-sm leading-6 text-cg-text">
            Use inventory reallocation and the backup supplier to stabilize service, then restore normal sourcing over approximately {formatNumber(kpis.recovery_time, { maximumFractionDigits: 1 })} days.
          </p>
        </div>
      </div>
    </Card>
  )
}

export default function Simulation() {
  const [supplierId, setSupplierId] = useState('')
  const [inventoryReduction, setInventoryReduction] = useState(20)
  const [shippingDelay, setShippingDelay] = useState(5)
  const [demandIncrease, setDemandIncrease] = useState(15)
  const [geopoliticalRisk, setGeopoliticalRisk] = useState('Medium')
  const [result, setResult] = useState(null)
  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState(null)
  const fetchSuppliers = useCallback(() => getSuppliers({ limit: 500 }), [])
  const { data: supplierData = [], loading: suppliersLoading, error: suppliersError } = useApi(fetchSuppliers)
  const suppliers = Array.isArray(supplierData) ? supplierData.filter(Boolean) : []

  useEffect(() => {
    if (!supplierId && suppliers.length) setSupplierId(suppliers[0].supplier_id)
  }, [supplierId, suppliers])

  const run = async () => {
    if (!supplierId) return
    setRunning(true)
    setRunError(null)
    try {
      const response = await runSimulation({ supplier_id: supplierId, inventory_reduction: inventoryReduction, shipping_delay_days: shippingDelay, demand_increase: demandIncrease, geopolitical_risk: geopoliticalRisk })
      setResult(response.data)
    } catch (error) {
      setResult(null)
      setRunError(error.message || 'Unable to run the supply chain simulation.')
    } finally {
      setRunning(false)
    }
  }

  const kpis = result?.kpis
  const metricTones = [
    { border: 'border-l-red-400', background: 'bg-red-500/10', icon: 'text-red-400' },
    { border: 'border-l-orange-400', background: 'bg-orange-500/10', icon: 'text-orange-400' },
    { border: 'border-l-yellow-400', background: 'bg-yellow-500/10', icon: 'text-yellow-400' },
    { border: 'border-l-emerald-400', background: 'bg-emerald-500/10', icon: 'text-emerald-400' },
    { border: 'border-l-blue-400', background: 'bg-blue-500/10', icon: 'text-blue-400' },
  ]

  return <div className="space-y-6">
    <PageHeader title="What-If Supply Chain Simulation" description="Model supplier failure and operational disruption scenarios using the current supply-chain data." actions={<Button onClick={run} disabled={running || !supplierId}>{running ? <Clock3 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}{running ? 'Running simulation…' : 'Run Simulation'}</Button>} />
    <Card><div className="grid gap-6 xl:grid-cols-5"><label className="block"><span className="mb-2 block text-sm font-medium text-cg-text">Supplier failure</span><select value={supplierId} onChange={event => setSupplierId(event.target.value)} disabled={suppliersLoading} className="w-full rounded-cg border border-cg-border bg-cg-hover px-3 py-2 text-sm text-cg-text"><option value="">Select supplier</option>{suppliers.map(supplier => <option key={supplier.supplier_id} value={supplier.supplier_id}>{supplier.supplier_name || supplier.supplier_id}</option>)}</select></label><SliderControl label="Inventory reduction" value={inventoryReduction} max={100} suffix="%" onChange={setInventoryReduction}/><SliderControl label="Shipping delay" value={shippingDelay} max={60} suffix=" days" onChange={setShippingDelay}/><SliderControl label="Demand increase" value={demandIncrease} max={100} suffix="%" onChange={setDemandIncrease}/><label className="block"><span className="mb-2 block text-sm font-medium text-cg-text">Geopolitical risk</span><select value={geopoliticalRisk} onChange={event => setGeopoliticalRisk(event.target.value)} className="w-full rounded-cg border border-cg-border bg-cg-hover px-3 py-2 text-sm text-cg-text">{['Low', 'Medium', 'High'].map(level => <option key={level}>{level}</option>)}</select></label></div></Card>
    {suppliersError && <ErrorState title="Unable to load simulation controls" message={suppliersError} onRetry={fetchSuppliers}/>} {running && <LoadingSpinner label="Calculating scenario impact from current supply-chain data..."/>} {!running && runError && <ErrorState title="Simulation could not be completed" message={runError} onRetry={run}/>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><Metric label="Overall Risk Score" value={kpis?.overall_risk_score} suffix="/100" icon={AlertTriangle} tone={metricTones[0]}/><Metric label="Estimated Delivery Delay" value={kpis?.estimated_delivery_delay} suffix=" days" icon={Truck} tone={metricTones[1]}/><Metric label="Estimated Cost Increase" value={kpis?.estimated_cost_increase} suffix="%" icon={DollarSign} tone={metricTones[2]}/><Metric label="Service Level" value={kpis?.service_level} suffix="%" icon={ShieldCheck} tone={metricTones[3]}/><Metric label="Recovery Time" value={kpis?.recovery_time} suffix=" days" icon={Clock3} tone={metricTones[4]}/></div>
    {!running && !runError && !result && <EmptyState title="No scenario has been run" message="Choose a supplier and disruption inputs, then run the simulation to compare operational impact." icon={Play}/>}
    {!running && result && <div className="space-y-6"><div className="grid gap-6 xl:grid-cols-3"><Card className="xl:col-span-1"><h2 className="text-base font-semibold text-cg-text">Scenario summary</h2><div className="mt-4 space-y-4 text-sm"><div><p className="text-cg-muted">Failed supplier</p><p className="mt-1 font-semibold text-cg-text">{result.supplier?.supplier_name || result.supplier?.supplier_id || '—'}</p></div><div><p className="text-cg-muted">Recommended backup supplier</p><p className="mt-1 font-semibold text-cg-text">{result.recommended_backup_supplier?.supplier_name || 'No linked backup supplier found'}</p>{result.recommended_backup_supplier?.country && <p className="mt-1 text-cg-muted">{result.recommended_backup_supplier.country}</p>}</div><div><p className="text-cg-muted">Affected products</p><p className="mt-1 font-medium text-cg-text">{result.affected_products?.map(product => product.name || product.product_id).filter(Boolean).join(', ') || 'None identified'}</p></div><div><p className="text-cg-muted">Affected warehouses</p><p className="mt-1 font-medium text-cg-text">{result.affected_warehouses?.filter(Boolean).join(', ') || 'None identified'}</p></div></div></Card><Card className="xl:col-span-2"><div className="flex items-baseline justify-between gap-3"><h2 className="text-base font-semibold text-cg-text">Before vs after scenario</h2><span className="text-xs text-cg-muted">Baseline vs simulated impact</span></div><div className="mt-4 h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={result.comparison || []} barGap={6}><CartesianGrid stroke="var(--color-cg-chart-grid)" strokeDasharray="3 3"/><XAxis dataKey="metric" tick={{ fill: 'var(--color-cg-chart-axis)', fontSize: 11 }} tickLine={false}/><YAxis tick={{ fill: 'var(--color-cg-chart-axis)', fontSize: 11 }} tickLine={false}/><Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--color-cg-hover)' }}/><Legend wrapperStyle={{ color: 'var(--color-cg-muted)', fontSize: 12 }}/><Bar dataKey="before" name="Current baseline" fill="var(--color-cg-chart-series-muted)" radius={[4, 4, 0, 0]}/><Bar dataKey="after" name="Simulated scenario" fill="var(--color-risk-medium)" radius={[4, 4, 0, 0]}/></BarChart></ResponsiveContainer></div></Card></div><Card><div className="flex items-baseline justify-between gap-3"><h2 className="text-base font-semibold text-cg-text">Risk contribution by scenario driver</h2><span className="text-xs text-cg-muted">Risk-score points</span></div><div className="mt-4 h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={result.drivers || []} layout="vertical" margin={{ left: 16 }}><CartesianGrid stroke="var(--color-cg-chart-grid)" strokeDasharray="3 3" horizontal={false}/><XAxis type="number" tick={{ fill: 'var(--color-cg-chart-axis)', fontSize: 11 }} tickLine={false}/><YAxis type="category" dataKey="name" width={132} tick={{ fill: 'var(--color-cg-chart-axis)', fontSize: 12 }} tickLine={false} axisLine={false}/><Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--color-cg-hover)' }} formatter={value => [`${formatNumber(value, { maximumFractionDigits: 1 })} points`, 'Contribution']}/><Bar dataKey="impact" name="Contribution" fill="var(--color-risk-medium)" radius={[0, 4, 4, 0]} barSize={20}/></BarChart></ResponsiveContainer></div></Card><RecommendedResponse result={result}/><div className="grid gap-6 md:grid-cols-2"><Card><div className="flex items-center gap-2"><Factory className="h-4 w-4 text-cg-secondary"/><h2 className="text-base font-semibold text-cg-text">Affected products</h2></div><div className="mt-4 space-y-2">{result.affected_products?.length ? result.affected_products.map(product => <div key={product.product_id} className="rounded-cg bg-cg-hover px-3 py-2 text-sm text-cg-text">{product.name || product.product_id}</div>) : <p className="text-sm text-cg-muted">No affected products identified.</p>}</div></Card><Card><div className="flex items-center gap-2"><Boxes className="h-4 w-4 text-cg-secondary"/><h2 className="text-base font-semibold text-cg-text">Affected warehouses</h2></div><div className="mt-4 space-y-2">{result.affected_warehouses?.length ? result.affected_warehouses.map(warehouse => <div key={warehouse} className="rounded-cg bg-cg-hover px-3 py-2 text-sm text-cg-text">{warehouse}</div>) : <p className="text-sm text-cg-muted">No affected warehouses identified.</p>}</div></Card></div></div>}
  </div>
}
