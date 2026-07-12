import { useCallback, useEffect, useMemo, useState } from 'react'
import { Eye, RefreshCw, Search, X } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getNews, getNewsById, getNewsSummary } from '../api'
import { Button, Card, EmptyState, ErrorState, LoadingSpinner, PageHeader, RiskBadge } from '../components/common'
import { useApi } from '../hooks/useApi'
import { ensureArray } from '../utils/dashboardMetrics'
import { formatDate, formatNumber, formatPercent } from '../utils/formatters'

const NEWS_LIMIT = 500
const SEVERITY_COLORS = { High: '#ef4444', Medium: '#f59e0b', Low: '#22c55e' }
const RISK_CATEGORIES = [
  'Geopolitical',
  'Natural Disaster',
  'Logistics',
  'Supplier Operational',
  'Regulatory',
  'Cybersecurity',
  'Product Quality',
]

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
    <div className="flex items-start justify-between gap-4 border-b border-cg-border/70 py-3 last:border-b-0">
      <span className="text-sm text-cg-muted">{label}</span>
      <span className="text-right text-sm font-medium text-cg-text">{value ?? '—'}</span>
    </div>
  )
}

function NewsCharts({ events }) {
  const severityData = ['High', 'Medium', 'Low'].map((level) => ({
    name: level,
    value: events.filter((item) => item.severity === level).length,
  }))
  const categoryData = Object.values(
    events.reduce((result, event) => {
      const category = event.risk_category || 'Unclassified'
      result[category] = result[category] || { name: category, value: 0 }
      result[category].value += 1
      return result
    }, {}),
  )
  const countryData = Object.values(
    events.reduce((result, event) => {
      if (!event.country) return result
      result[event.country] = result[event.country] || { country: event.country, events: 0 }
      result[event.country].events += 1
      return result
    }, {}),
  )
    .sort((a, b) => b.events - a.events)
    .slice(0, 8)
  const colors = ['#4f8cff', '#a78bfa', '#14b8a6', '#f59e0b', '#ef4444', '#38bdf8', '#f472b6']

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Card>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-cg-text">Risk distribution</h2>
        <p className="mt-1 text-sm text-cg-muted">Severity mix across monitored news events.</p>
        <div className="mt-5 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={severityData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={92} paddingAngle={3}>
                {severityData.map((item) => (
                  <Cell key={item.name} fill={SEVERITY_COLORS[item.name]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#172033', border: '1px solid #334155', borderRadius: '8px' }}
                labelStyle={{ color: '#e2e8f0' }}
                itemStyle={{ color: '#e2e8f0' }}
              />
              <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-cg-text">Category distribution</h2>
        <p className="mt-1 text-sm text-cg-muted">Enterprise risk categories across monitored events.</p>
        <div className="mt-5 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={92} paddingAngle={3}>
                {categoryData.map((item, index) => (
                  <Cell key={item.name} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#172033', border: '1px solid #334155', borderRadius: '8px' }}
                labelStyle={{ color: '#e2e8f0' }}
                itemStyle={{ color: '#e2e8f0' }}
              />
              <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-cg-text">Country distribution</h2>
        <p className="mt-1 text-sm text-cg-muted">Top countries by monitored event volume.</p>
        <div className="mt-5 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={countryData} layout="vertical" margin={{ top: 8, right: 16, left: 24, bottom: 0 }}>
              <CartesianGrid stroke="#334155" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 12 }} tickLine={false} axisLine={false} />
              <YAxis dataKey="country" type="category" width={88} tick={{ fill: '#94a3b8', fontSize: 12 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: '#172033', border: '1px solid #334155', borderRadius: '8px' }}
                labelStyle={{ color: '#e2e8f0' }}
                itemStyle={{ color: '#e2e8f0' }}
              />
              <Bar dataKey="events" name="Events" fill="#4f8cff" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  )
}

function NewsTimeline({ events }) {
  const timeData = Object.values(
    events.reduce((result, event) => {
      if (!event.date) return result
      result[event.date] = result[event.date] || { date: event.date, events: 0 }
      result[event.date].events += 1
      return result
    }, {}),
  ).sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-cg-text">Events over time</h2>
        <p className="mt-1 text-sm text-cg-muted">Published events grouped by date.</p>
        <div className="mt-5 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timeData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 12 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: '#172033', border: '1px solid #334155', borderRadius: '8px' }}
                labelStyle={{ color: '#e2e8f0' }}
                itemStyle={{ color: '#e2e8f0' }}
              />
              <Line type="monotone" dataKey="events" name="Events" stroke="#4f8cff" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-cg-text">Latest event timeline</h2>
            <p className="mt-1 text-sm text-cg-muted">Newest events first.</p>
          </div>
        </div>
        <div className="mt-5 max-h-72 overflow-y-auto pl-1">
          {events.slice(0, 10).map((event, index) => (
            <div key={event.id} className="relative flex gap-4 pb-5 last:pb-0">
              <div className="flex flex-col items-center">
                <span className="mt-1 h-3 w-3 rounded-full bg-cg-secondary ring-4 ring-cg-secondary/15" />
                {index < Math.min(events.length, 10) - 1 && <span className="mt-2 h-full w-px bg-cg-border" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-cg-text">{event.headline}</p>
                  <RiskBadge level={event.severity} />
                </div>
                <p className="mt-1 text-xs text-cg-muted">
                  {formatDate(event.date)} · {event.risk_category || '—'} · {event.country || '—'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function NewsDetails({ event, loading, error, onRetry, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Close news details" className="absolute inset-0 bg-cg-primary/20" onClick={onClose} />
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
        {!loading && error && <ErrorState title="Unable to load news details" message={error} onRetry={onRetry} />}
        {!loading && !error && event && (
          <>
            <div className="mt-5 flex flex-wrap gap-2">
              <RiskBadge level={event.severity} />
              <RiskBadge level={event.status} label={`Status: ${event.status || 'Open'}`} />
            </div>
            <p className="mt-5 rounded-cg border border-cg-border bg-cg-hover p-4 text-sm leading-6 text-cg-muted">
              {event.summary || 'No summary available.'}
            </p>
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

export default function NewsMonitoring() {
  const [search, setSearch] = useState('')
  const [country, setCountry] = useState('')
  const [category, setCategory] = useState('')
  const [severity, setSeverity] = useState('')
  const [status, setStatus] = useState('')
  const [date, setDate] = useState('')
  const [sort, setSort] = useState('date')
  const [selectedId, setSelectedId] = useState(null)

  const fetchNews = useCallback(async () => {
    const [events, summary] = await Promise.all([
      getNews({
        limit: NEWS_LIMIT,
        ...(search.trim() && { search: search.trim() }),
        ...(country && { country }),
        ...(category && { category }),
        ...(severity && { severity }),
        ...(status && { status }),
        ...(date && { date }),
        sort,
      }),
      getNewsSummary(),
    ])
    return { events: events.data, summary: summary.data }
  }, [search, country, category, severity, status, date, sort])

  const { data, loading, error, refetch } = useApi(fetchNews)
  const events = ensureArray(data?.events).filter((item) => item && typeof item === 'object')
  const summary = data?.summary && typeof data.summary === 'object' ? data.summary : null

  const fetchDetail = useCallback(() => (selectedId ? getNewsById(selectedId) : null), [selectedId])
  const { data: detailData, loading: detailLoading, error: detailError, refetch: refetchDetail } = useApi(fetchDetail, [], { immediate: false })
  const detail = detailData && typeof detailData === 'object' && !Array.isArray(detailData) ? detailData : null

  useEffect(() => {
    if (selectedId) refetchDetail().catch(() => {})
  }, [selectedId, refetchDetail])

  const options = useMemo(
    () => ({
      countries: [...new Set(events.map((item) => item.country).filter(Boolean))].sort(),
      severities: ['High', 'Medium', 'Low'],
      statuses: [...new Set(events.map((item) => item.status).filter(Boolean))].sort(),
    }),
    [events],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="News Monitoring"
        description="Monitor global supply chain events affecting suppliers, logistics and manufacturing operations."
      />
      <Card>
        <div className="grid gap-4 xl:grid-cols-8">
          <label className="relative xl:col-span-2">
            <span className="sr-only">Search news</span>
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-cg-muted" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search headline, country or supplier"
              className="w-full rounded-cg border border-cg-border bg-cg-hover py-2 pl-9 pr-3 text-sm text-cg-text outline-none focus:border-cg-secondary"
            />
          </label>
          <select value={country} onChange={(event) => setCountry(event.target.value)} className="rounded-cg border border-cg-border bg-cg-hover px-3 py-2 text-sm text-cg-text">
            <option value="">All countries</option>
            {options.countries.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-cg border border-cg-border bg-cg-hover px-3 py-2 text-sm text-cg-text">
            <option value="">All categories</option>
            {RISK_CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select value={severity} onChange={(event) => setSeverity(event.target.value)} className="rounded-cg border border-cg-border bg-cg-hover px-3 py-2 text-sm text-cg-text">
            <option value="">All severities</option>
            {options.severities.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-cg border border-cg-border bg-cg-hover px-3 py-2 text-sm text-cg-text">
            <option value="">All statuses</option>
            {options.statuses.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <input
            aria-label="Filter by date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="rounded-cg border border-cg-border bg-cg-hover px-3 py-2 text-sm text-cg-text"
          />
          <div className="flex gap-2">
            <select value={sort} onChange={(event) => setSort(event.target.value)} className="min-w-0 flex-1 rounded-cg border border-cg-border bg-cg-hover px-3 py-2 text-sm text-cg-text">
              <option value="date">Sort: Newest</option>
              <option value="severity">Sort: Severity</option>
              <option value="dynamic_risk_score">Sort: Risk Score</option>
              <option value="headline">Sort: Headline</option>
              <option value="country">Sort: Country</option>
              <option value="supplier">Sort: Supplier</option>
              <option value="category">Sort: Category</option>
              <option value="status">Sort: Status</option>
              <option value="probability">Sort: Probability</option>
              <option value="business_impact">Sort: Impact</option>
            </select>
            <Button aria-label="Refresh news" onClick={refetch} disabled={loading}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
      {!loading && !error && summary && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Total News Events" value={formatNumber(summary.total_news_events)} />
          <SummaryCard label="High Severity Events" value={formatNumber(summary.high_severity_events)} />
          <SummaryCard label="Countries Impacted" value={formatNumber(summary.countries_impacted)} />
          <SummaryCard label="Affected Suppliers" value={formatNumber(summary.affected_suppliers)} />
        </div>
      )}
      {loading && <LoadingSpinner label="Loading news monitoring..." />}
      {!loading && error && <ErrorState title="Unable to load news monitoring" message={error} onRetry={refetch} />}
      {!loading && !error && events.length === 0 && (
        <EmptyState title="No news events found" message="Try changing the search term or removing one or more filters." />
      )}
      {!loading && !error && events.length > 0 && (
        <>
          <NewsCharts events={events} />
          <NewsTimeline events={events} />
          <Card padding="none" className="overflow-hidden">
            <div className="border-b border-cg-border px-5 py-3">
              <p className="text-sm text-cg-muted">{formatNumber(events.length)} monitored events</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-cg-hover text-xs uppercase tracking-wide text-cg-muted">
                  <tr>
                    {[
                      'Date',
                      'Headline',
                      'Country',
                      'Supplier',
                      'Product',
                      'Component',
                      'Category',
                      'Severity',
                      'Probability',
                      'Risk Score',
                      'Impact',
                      'Status',
                      'Actions',
                    ].map((label) => (
                      <th key={label} className="px-5 py-3">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-cg-border/70">
                  {events.map((event) => (
                    <tr key={event.id} className="text-cg-muted">
                      <td className="whitespace-nowrap px-5 py-4">{formatDate(event.date)}</td>
                      <td className="min-w-72 px-5 py-4 font-medium text-cg-text">{event.headline}</td>
                      <td className="px-5 py-4">{event.country || '—'}</td>
                      <td className="px-5 py-4">{event.supplier_name || event.affected_supplier || '—'}</td>
                      <td className="px-5 py-4">{event.affected_product || '—'}</td>
                      <td className="px-5 py-4">{event.affected_component || '—'}</td>
                      <td className="px-5 py-4">{event.risk_category || '—'}</td>
                      <td className="px-5 py-4">
                        <RiskBadge level={event.severity} />
                      </td>
                      <td className="px-5 py-4">{formatPercent(event.probability)}</td>
                      <td className="px-5 py-4">{formatNumber(event.dynamic_risk_score, { maximumFractionDigits: 2 })}</td>
                      <td className="px-5 py-4">{formatNumber(event.business_impact)}</td>
                      <td className="px-5 py-4">{event.status || '—'}</td>
                      <td className="px-5 py-4">
                        <Button size="sm" onClick={() => setSelectedId(event.id)}>
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
      {selectedId && (
        <NewsDetails event={detail} loading={detailLoading} error={detailError} onRetry={refetchDetail} onClose={() => setSelectedId(null)} />
      )}
    </div>
  )
}
