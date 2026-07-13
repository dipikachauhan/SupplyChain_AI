import { useCallback, useState } from 'react'
import { AlertTriangle, BrainCircuit, Clock3, DollarSign, Gauge, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react'
import { generateAIRecommendation, getSuppliers } from '../api'
import { Button, Card, EmptyState, ErrorState, LoadingSpinner, PageHeader, RiskBadge } from '../components/common'
import { useApi } from '../hooks/useApi'
import { formatNumber } from '../utils/formatters'

function Metric({ label, value, icon: Icon }) {
  return <Card><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-cg-muted">{label}</p><p className="mt-3 text-3xl font-semibold text-cg-text">{value ?? '—'}</p></div><Icon className="h-5 w-5 text-cg-secondary" /></div></Card>
}

function DetailCard({ title, icon: Icon, children }) {
  return <Card><div className="flex items-center gap-2"><Icon className="h-4 w-4 text-cg-secondary" /><h2 className="text-sm font-semibold text-cg-text">{title}</h2></div><div className="mt-3 text-sm leading-6 text-cg-muted">{children}</div></Card>
}

export default function AIRecommendations() {
  const [country, setCountry] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [riskLevel, setRiskLevel] = useState('')
  const [recommendation, setRecommendation] = useState(null)
  const [context, setContext] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [generationError, setGenerationError] = useState(null)
  const fetchSuppliers = useCallback(() => getSuppliers({ limit: 500 }), [])
  const { data: suppliers = [] } = useApi(fetchSuppliers)
  const supplierList = Array.isArray(suppliers)
  ? suppliers.filter(item => item != null)
  : []

  const countries = [
  ...new Set(
    supplierList
      .map(item => item?.country)
      .filter(Boolean)
     ),
    ].sort()

  const generate = async () => {
    setGenerating(true)
    setGenerationError(null)
    try {
      const response = await generateAIRecommendation({ ...(country && { country }), ...(supplierId && { supplier_id: supplierId }), ...(riskLevel && { risk_level: riskLevel }) })
      setRecommendation(response.data.recommendation)
      setContext(response.data.context)
    } catch (error) {
      setRecommendation(null)
      setContext(null)
      setGenerationError(error.message || 'Unable to generate an AI recommendation.')
    } finally {
      setGenerating(false)
    }
  }

  const kpis = context?.kpis || {}
  return <div className="space-y-6">
    <PageHeader title="AI Recommendations" description="Generate evidence-based mitigation strategies from live supplier, risk, news, inventory, and network context." actions={<Button onClick={generate} disabled={generating}>{generating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{generating ? 'Generating…' : 'Generate AI Recommendation'}</Button>} />
    <Card><div className="grid gap-3 lg:grid-cols-3"><select value={country} onChange={event => setCountry(event.target.value)} className="rounded-cg border border-cg-border bg-cg-hover px-3 py-2 text-sm text-cg-text"><option value="">All countries</option>{countries.map(item => <option key={item} value={item}>{item}</option>)}</select><select value={supplierId} onChange={event => setSupplierId(event.target.value)} className="rounded-cg border border-cg-border bg-cg-hover px-3 py-2 text-sm text-cg-text"><option value="">All suppliers</option>{supplierList.map(item => <option key={item.supplier_id} value={item.supplier_id}>{item.supplier_name || item.supplier_id}</option>)}</select><select value={riskLevel} onChange={event => setRiskLevel(event.target.value)} className="rounded-cg border border-cg-border bg-cg-hover px-3 py-2 text-sm text-cg-text"><option value="">All risk levels</option>{['Low', 'Medium', 'High', 'Critical'].map(item => <option key={item} value={item}>{item}</option>)}</select></div></Card>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Monitored Suppliers" value={context ? formatNumber(kpis.monitored_suppliers) : null} icon={BrainCircuit}/><Metric label="High-Risk Suppliers" value={context ? formatNumber(kpis.high_risk_suppliers) : null} icon={AlertTriangle}/><Metric label="Active News Events" value={context ? formatNumber(kpis.active_news_events) : null} icon={Gauge}/><Metric label="Inventory Alerts" value={context ? formatNumber(kpis.inventory_alerts) : null} icon={ShieldCheck}/></div>
    {generating && <LoadingSpinner label="Analyzing supply-chain context with Gemini..." />}
    {!generating && generationError && <ErrorState title="Unable to generate AI recommendation" message={generationError} onRetry={generate}/>} 
    {!generating && !generationError && !recommendation && <EmptyState title="No AI recommendation generated" message="Choose optional filters, then generate a recommendation from the current operational data." icon={Sparkles}/>} 
    {!generating && !generationError && recommendation && <div className="space-y-6">
      <Card><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-cg-muted">Executive summary</p><p className="mt-2 max-w-4xl text-base leading-7 text-cg-text">{recommendation.executive_summary}</p></div><div className="flex items-center gap-3"><RiskBadge level={recommendation.priority}/><div className="rounded-cg border border-cg-border px-3 py-2 text-right"><p className="text-[10px] uppercase tracking-wide text-cg-muted">Confidence</p><p className="text-lg font-semibold text-cg-text">{formatNumber(recommendation.confidence_score, { maximumFractionDigits: 0 })}%</p></div></div></div></Card>
      <div className="grid gap-6 xl:grid-cols-2"><DetailCard title="Business impact" icon={AlertTriangle}>{recommendation.business_impact}</DetailCard><DetailCard title="Expected risk reduction" icon={ShieldCheck}>{recommendation.expected_risk_reduction}</DetailCard><DetailCard title="Estimated timeline" icon={Clock3}>{recommendation.estimated_timeline}</DetailCard><DetailCard title="Estimated cost" icon={DollarSign}>{recommendation.estimated_cost}</DetailCard></div>
      <Card><h2 className="text-base font-semibold text-cg-text">Recommended actions</h2><div className="mt-4 grid gap-3">{recommendation.recommended_actions?.map((action, index) => <div key={`${action.title}-${index}`} className="rounded-cg border border-cg-border bg-cg-hover/40 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-cg-text">{action.title}</p><span className="text-xs text-cg-secondary">{action.owner}</span></div><p className="mt-2 text-sm leading-6 text-cg-muted">{action.description}</p></div>)}</div></Card>
      <div className="grid gap-6 xl:grid-cols-3"><DetailCard title="Related suppliers" icon={BrainCircuit}><ul className="space-y-1">{recommendation.related_supplier?.map(item => <li key={item}>{item}</li>)}</ul></DetailCard><DetailCard title="Related news" icon={Gauge}><ul className="space-y-1">{recommendation.related_news?.map(item => <li key={item}>{item}</li>)}</ul></DetailCard><DetailCard title="Related risks" icon={AlertTriangle}><ul className="space-y-1">{recommendation.related_risks?.map(item => <li key={item}>{item}</li>)}</ul></DetailCard></div>
    </div>}
  </div>
}
