import { useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Globe2,
  Newspaper,
  PackageSearch,
  Route,
  ShieldAlert,
  Sparkles,
  Truck,
  Users,
} from 'lucide-react'
import {
  getDashboardMetrics,
  getInventory,
  getLogistics,
  getNews,
  getRiskScores,
  getSuppliers,
} from '../api'
import {
  Card,
  EmptyState,
  ErrorState,
  LoadingSpinner,
  PageHeader,
  RiskBadge,
} from '../components/common'
import { useApi } from '../hooks/useApi'
import {
  formatDate,
  formatNumber,
  truncateText,
} from '../utils/formatters'
import {
  getHighRiskSuppliers,
  getInventorySummary,
  getLogisticsSummary,
  getOverviewStatus,
  getRiskDistribution,
  hasDashboardMetrics,
  normalizeDashboardMetrics,
} from '../utils/dashboardMetrics'

const DASHBOARD_LIMIT = 100

function SectionHeader({ title, subtitle }) {
  return (
    <div>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-cg-text">
        {title}
      </h2>
      {subtitle && <p className="mt-1 text-sm text-cg-muted">{subtitle}</p>}
    </div>
  )
}

function KpiCard({ title, value, description, icon: Icon, accent = 'text-cg-secondary' }) {
  return (
    <Card className="h-full">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-cg-muted">{title}</p>
          <p className="mt-2 text-2xl font-semibold text-cg-text">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-cg border border-cg-border bg-cg-hover">
          <Icon className={`h-5 w-5 ${accent}`} />
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-cg-muted">{description}</p>
    </Card>
  )
}

function MetricRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-cg-border/70 py-3 last:border-b-0">
      <span className="text-sm text-cg-muted">{label}</span>
      <span className="text-sm font-semibold text-cg-text">{value}</span>
    </div>
  )
}

function RiskDistributionCard({ distribution }) {
  const total = distribution.reduce((sum, item) => sum + item.count, 0)

  return (
    <Card className="h-full">
      <div className="flex items-start justify-between gap-4">
        <SectionHeader
          title="Risk Distribution"
          subtitle="Supplier risk levels from the risk API."
        />
        <ShieldAlert className="h-5 w-5 text-cg-secondary" />
      </div>

      {total === 0 ? (
        <p className="mt-8 text-sm text-cg-muted">No supplier risk scores are available.</p>
      ) : (
        <div className="mt-6 space-y-5">
          {distribution.map((item) => (
            <div key={item.key}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-cg-text">{item.label}</span>
                <span className="text-sm text-cg-muted">
                  {formatNumber(item.count)} ({item.percent}%)
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-cg-hover">
                <div
                  className={`h-full rounded-full ${item.colorClass}`}
                  style={{ width: `${item.percent}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function InventorySummaryCard({ summary }) {
  return (
    <Card className="h-full">
      <div className="flex items-start justify-between gap-4">
        <SectionHeader
          title="Inventory Summary"
          subtitle="Stock posture across inventory records."
        />
        <Boxes className="h-5 w-5 text-cg-secondary" />
      </div>

      <div className="mt-5">
        <MetricRow label="Inventory records" value={formatNumber(summary.itemCount)} />
        <MetricRow label="Current stock" value={formatNumber(summary.totalStock)} />
        <MetricRow label="Safety stock" value={formatNumber(summary.safetyStock)} />
        <MetricRow label="Low-stock items" value={formatNumber(summary.lowStockItems)} />
        <MetricRow label="Warehouses" value={formatNumber(summary.warehouses)} />
      </div>
    </Card>
  )
}

function LogisticsSummaryCard({ summary }) {
  return (
    <Card className="h-full">
      <div className="flex items-start justify-between gap-4">
        <SectionHeader
          title="Logistics Summary"
          subtitle="Route coverage and transit characteristics."
        />
        <Truck className="h-5 w-5 text-cg-secondary" />
      </div>

      <div className="mt-5">
        <MetricRow label="Active routes" value={formatNumber(summary.routeCount)} />
        <MetricRow label="Countries covered" value={formatNumber(summary.countries)} />
        <MetricRow
          label="Average transit"
          value={
            summary.averageTransitDays === null
              ? '-'
              : `${formatNumber(summary.averageTransitDays, { maximumFractionDigits: 1 })} days`
          }
        />
      </div>

      <div className="mt-5 border-t border-cg-border pt-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-cg-muted">
          Transport Mix
        </p>
        {summary.topMethods.length > 0 ? (
          <div className="space-y-2">
            {summary.topMethods.map((method) => (
              <div key={method.label} className="flex items-center justify-between gap-3">
                <span className="text-sm text-cg-muted">{method.label}</span>
                <span className="text-sm font-medium text-cg-text">
                  {formatNumber(method.count)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-cg-muted">No route methods available.</p>
        )}
      </div>
    </Card>
  )
}

function LatestNewsCard({ news }) {
  const latestNews = news.slice(0, 5)

  return (
    <Card className="h-full">
      <div className="flex items-start justify-between gap-4">
        <SectionHeader
          title="Latest Risk News"
          subtitle="Recent events reported by the backend."
        />
        <Newspaper className="h-5 w-5 text-cg-secondary" />
      </div>

      {latestNews.length === 0 ? (
        <p className="mt-8 text-sm text-cg-muted">No recent risk news is available.</p>
      ) : (
        <div className="mt-5 divide-y divide-cg-border/70">
          {latestNews.map((item) => (
            <article key={item.id || item.headline} className="py-4 first:pt-0 last:pb-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <RiskBadge level={item.severity} label={item.severity || 'Unknown'} />
                <span className="text-xs text-cg-muted">{formatDate(item.date)}</span>
              </div>
              <h3 className="text-sm font-semibold leading-6 text-cg-text hover:text-cg-secondary transition-colors">
                <Link to={`/news?selectedId=${item.id}`}>
                  {item.headline || 'Untitled event'}
                </Link>
              </h3>
              <p className="mt-1 text-sm text-cg-muted">
                {[item.country, item.risk_category, item.status].filter(Boolean).join(' / ') ||
                  'No additional context provided.'}
              </p>
            </article>
          ))}
        </div>
      )}
    </Card>
  )
}

function HighRiskSuppliersCard({ suppliers }) {
  return (
    <Card className="h-full">
      <div className="flex items-start justify-between gap-4">
        <SectionHeader
          title="High Risk Suppliers"
          subtitle="Suppliers with high risk classification."
        />
        <AlertTriangle className="h-5 w-5 text-risk-high" />
      </div>

      {suppliers.length === 0 ? (
        <p className="mt-8 text-sm text-cg-muted">No high-risk suppliers are currently listed.</p>
      ) : (
        <div className="mt-5 overflow-hidden rounded-cg border border-cg-border">
          <div className="grid grid-cols-[1.4fr_1fr_auto] gap-3 border-b border-cg-border bg-cg-hover px-4 py-3 text-xs font-semibold uppercase tracking-wide text-cg-muted">
            <span>Supplier</span>
            <span>Country</span>
            <span className="text-right">Risk</span>
          </div>
          {suppliers.map((supplier) => (
            <div
              key={supplier.supplier_id}
              className="grid grid-cols-[1.4fr_1fr_auto] items-center gap-3 border-b border-cg-border/70 px-4 py-3 last:border-b-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-cg-text">
                  {supplier.supplier_name || supplier.supplier_id}
                </p>
                <p className="mt-1 text-xs text-cg-muted">{supplier.supplier_id}</p>
              </div>
              <span className="truncate text-sm text-cg-muted">{supplier.country || '-'}</span>
              <RiskBadge level={supplier.risk_level} label={supplier.risk_level || 'High'} />
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function RecommendationPreviewCard() {
  return (
    <Card className="h-full">
      <div className="flex items-start justify-between gap-4">
        <SectionHeader
          title="AI Recommendation Preview"
          subtitle="Recent mitigation recommendations when exposed by the API."
        />
        <Sparkles className="h-5 w-5 text-cg-secondary" />
      </div>

      <p className="mt-8 text-sm leading-6 text-cg-muted">
        No mitigation recommendation payload is available from the current dashboard APIs.
      </p>
    </Card>
  )
}

function OverviewCard({ status, metrics }) {
  const statusIcon =
    status.level === 'high' ? AlertTriangle : status.level === 'medium' ? ShieldAlert : CheckCircle2
  const StatusIcon = statusIcon

  return (
    <Card>
      <div className="grid gap-6 lg:grid-cols-[1.2fr_2fr] lg:items-center">
        <div>
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-cg border border-cg-border bg-cg-hover">
            <StatusIcon className="h-6 w-6 text-cg-secondary" />
          </div>
          <SectionHeader
            title="Quick Supply Chain Overview"
            subtitle="Overall system status from current dashboard signals."
          />
        </div>
        <div>
          <h3 className="text-2xl font-semibold text-cg-text">{status.label}</h3>
          <p className="mt-2 text-sm leading-6 text-cg-muted">{status.detail}</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {metrics.map((metric) => (
              <div key={metric.label} className="rounded-cg border border-cg-border p-4">
                <p className="text-xs uppercase tracking-wide text-cg-muted">{metric.label}</p>
                <p className="mt-2 text-lg font-semibold text-cg-text">{metric.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}

export default function Dashboard() {
  const fetchDashboardData = useCallback(async () => {
    const dashboard = await getDashboardMetrics()
    const [suppliers, inventory, logistics, riskScores, news] = await Promise.allSettled([
      getSuppliers({ limit: DASHBOARD_LIMIT }),
      getInventory({ limit: DASHBOARD_LIMIT }),
      getLogistics({ limit: DASHBOARD_LIMIT }),
      getRiskScores({ limit: DASHBOARD_LIMIT }),
      getNews({ limit: DASHBOARD_LIMIT }),
    ])

    return {
      metrics: normalizeDashboardMetrics(dashboard.data),
      suppliers: suppliers.status === 'fulfilled' ? suppliers.value.data : [],
      inventory: inventory.status === 'fulfilled' ? inventory.value.data : [],
      logistics: logistics.status === 'fulfilled' ? logistics.value.data : [],
      riskScores: riskScores.status === 'fulfilled' ? riskScores.value.data : [],
      news: news.status === 'fulfilled' ? news.value.data : [],
    }
  }, [])

  const { data, loading, error, refetch } = useApi(fetchDashboardData)

  const dashboardData = useMemo(() => {
    const suppliers = data?.suppliers || []
    const inventory = data?.inventory || []
    const logistics = data?.logistics || []
    const riskScores = data?.riskScores || []
    const news = data?.news || []
    const riskDistribution = getRiskDistribution(riskScores)
    const inventorySummary = getInventorySummary(inventory)
    const logisticsSummary = getLogisticsSummary(logistics)
    const highRiskSuppliers = getHighRiskSuppliers(suppliers, riskScores)
    const overviewStatus = getOverviewStatus({
      riskDistribution,
      inventorySummary,
      news,
    })

    return {
      metrics: normalizeDashboardMetrics(data?.metrics),
      news,
      riskDistribution,
      inventorySummary,
      logisticsSummary,
      highRiskSuppliers,
      overviewStatus,
    }
  }, [data])

  const hasMetrics = hasDashboardMetrics(data?.metrics)

  const kpis = [
    {
      title: 'Total Suppliers',
      value: formatNumber(dashboardData.metrics.total_suppliers),
      description: 'Suppliers registered across the network.',
      icon: Users,
      accent: 'text-cg-secondary',
    },
    {
      title: 'High Risk Suppliers',
      value: formatNumber(dashboardData.metrics.high_risk_suppliers),
      description: 'Suppliers currently classified as high risk.',
      icon: ShieldAlert,
      accent: 'text-risk-high',
    },
    {
      title: 'Inventory Items',
      value: formatNumber(dashboardData.metrics.total_inventory),
      description: 'Total inventory reported by the dashboard API.',
      icon: PackageSearch,
      accent: 'text-risk-safe',
    },
    {
      title: 'Active Logistics Routes',
      value: formatNumber(dashboardData.logisticsSummary.routeCount),
      description: 'Routes available from the logistics endpoint.',
      icon: Route,
      accent: 'text-cg-secondary',
    },
  ]

  const overviewMetrics = [
    {
      label: 'Products',
      value: formatNumber(dashboardData.metrics.total_products),
    },
    {
      label: 'News Events',
      value: formatNumber(dashboardData.metrics.recent_news_count),
    },
    {
      label: 'Total Inventory',
      value: formatNumber(dashboardData.metrics.total_inventory),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Executive overview of supply chain performance, risk exposure, inventory health, and operational alerts."
        actions={
          <div className="flex items-center gap-2 rounded-cg border border-cg-border bg-cg-card px-3 py-2 text-sm text-cg-muted">
            <Globe2 className="h-4 w-4 text-cg-secondary" />
            Live API data
          </div>
        }
      />

      {loading && <LoadingSpinner label="Loading dashboard intelligence..." />}

      {!loading && error && (
        <ErrorState
          title="Unable to load dashboard"
          message={error}
          onRetry={refetch}
        />
      )}

      {!loading && !error && !hasMetrics && (
        <EmptyState
          title="No dashboard data available"
          message="The backend returned no dashboard payload."
        />
      )}

      {!loading && !error && hasMetrics && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {kpis.map((kpi) => (
              <KpiCard key={kpi.title} {...kpi} />
            ))}
          </div>

          <OverviewCard
            status={dashboardData.overviewStatus}
            metrics={overviewMetrics}
          />

          <div className="grid gap-4 xl:grid-cols-3">
            <RiskDistributionCard distribution={dashboardData.riskDistribution} />
            <InventorySummaryCard summary={dashboardData.inventorySummary} />
            <LogisticsSummaryCard summary={dashboardData.logisticsSummary} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <LatestNewsCard
              news={[...dashboardData.news].sort((a, b) =>
                String(b.date || '').localeCompare(String(a.date || '')),
              )}
            />
            <HighRiskSuppliersCard suppliers={dashboardData.highRiskSuppliers} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <RecommendationPreviewCard />
            <Card>
              <div className="flex items-start justify-between gap-4">
                <SectionHeader
                  title="Operational Notes"
                  subtitle="Context from currently available backend fields."
                />
                <CheckCircle2 className="h-5 w-5 text-cg-secondary" />
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {dashboardData.news.slice(0, 4).map((item) => (
                  <div key={item.id || item.headline} className="rounded-cg border border-cg-border p-4">
                    <p className="text-xs uppercase tracking-wide text-cg-muted">
                      {item.country || 'Global'} / {item.risk_category || 'Risk event'}
                    </p>
                    <p className="mt-2 text-sm font-medium leading-6 text-cg-text hover:text-cg-secondary transition-colors">
                      <Link to={`/news?selectedId=${item.id}`}>
                        {truncateText(item.headline || 'Untitled event', 96)}
                      </Link>
                    </p>
                  </div>
                ))}
                {dashboardData.news.length === 0 && (
                  <p className="text-sm text-cg-muted">
                    No operational notes are available from the news endpoint.
                  </p>
                )}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
