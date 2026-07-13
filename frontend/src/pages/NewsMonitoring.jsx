import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Eye, RefreshCw, Search } from 'lucide-react'
import { getNews, getNewsById, getNewsSummary } from '../api'
import { Button, Card, EmptyState, ErrorState, LoadingSpinner, PageHeader, RiskBadge } from '../components/common'
import { useApi } from '../hooks/useApi'
import { ensureArray } from '../utils/dashboardMetrics'
import { formatDate, formatNumber, formatPercent } from '../utils/formatters'

// Import refactored modular sub-components
import NewsCharts from '../components/news/NewsCharts'
import NewsTimeline from '../components/news/NewsTimeline'
import NewsDetailsDrawer from '../components/news/NewsDetailsDrawer'

const NEWS_LIMIT = 500
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

export default function NewsMonitoring() {
  const [searchParams, setSearchParams] = useSearchParams()
  const querySelectedId = searchParams.get('selectedId')

  const [search, setSearch] = useState('')
  const [country, setCountry] = useState('')
  const [category, setCategory] = useState('')
  const [severity, setSeverity] = useState('')
  const [status, setStatus] = useState('')
  const [date, setDate] = useState('')
  const [sort, setSort] = useState('date')

  const selectedId = querySelectedId && !isNaN(parseInt(querySelectedId, 10)) ? parseInt(querySelectedId, 10) : null

  const setSelectedId = (id) => {
    const params = {}
    if (search.trim()) params.search = search.trim()
    if (country) params.country = country
    if (category) params.category = category
    if (severity) params.severity = severity
    if (status) params.status = status
    if (date) params.date = date
    if (sort && sort !== 'date') params.sort = sort
    if (id) params.selectedId = String(id)
    setSearchParams(params)
  }

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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <label className="relative sm:col-span-2 xl:col-span-2">
            <span className="sr-only">Search news</span>
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-cg-muted" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search headline, country or supplier"
              className="w-full rounded-cg border border-cg-border bg-cg-hover py-2 pl-9 pr-3 text-sm text-cg-text outline-none focus:border-cg-secondary"
            />
          </label>
          <select value={country} onChange={(event) => setCountry(event.target.value)} className="min-w-0 rounded-cg border border-cg-border bg-cg-hover px-3 py-2 text-sm text-cg-text">
            <option value="">All countries</option>
            {options.countries.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select value={category} onChange={(event) => setCategory(event.target.value)} className="min-w-0 rounded-cg border border-cg-border bg-cg-hover px-3 py-2 text-sm text-cg-text">
            <option value="">All categories</option>
            {RISK_CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select value={severity} onChange={(event) => setSeverity(event.target.value)} className="min-w-0 rounded-cg border border-cg-border bg-cg-hover px-3 py-2 text-sm text-cg-text">
            <option value="">All severities</option>
            {options.severities.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="min-w-0 rounded-cg border border-cg-border bg-cg-hover px-3 py-2 text-sm text-cg-text">
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
            className="min-w-0 rounded-cg border border-cg-border bg-cg-hover px-3 py-2 text-sm text-cg-text"
          />
          <div className="flex min-w-0 gap-2">
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
            <Button className="shrink-0" aria-label="Refresh news" onClick={refetch} disabled={loading}>
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
                        <Button
                            size="sm"
                            onClick={() => {
                              console.log("CLICKED", event.id)
                              setSelectedId(event.id)
                              console.log("URL:", window.location.href)
                            }}
                          >
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
        <NewsDetailsDrawer
          event={detail}
          loading={detailLoading}
          error={detailError}
          onRetry={refetchDetail}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  )
}

