import { normalizeRiskLevel, RISK_LEVELS } from './riskHelpers'

const EMPTY_COUNTS = {
  high: 0,
  medium: 0,
  low: 0,
  unknown: 0,
}

const DASHBOARD_METRIC_FIELDS = [
  'total_suppliers',
  'total_products',
  'high_risk_suppliers',
  'recent_news_count',
  'total_inventory',
]

export function ensureArray(value) {
  return Array.isArray(value) ? value : []
}

export function normalizeDashboardMetrics(metrics = {}) {
  return DASHBOARD_METRIC_FIELDS.reduce((normalized, field) => {
    normalized[field] = Number(metrics?.[field] || 0)
    return normalized
  }, {})
}

export function hasDashboardMetrics(metrics) {
  return DASHBOARD_METRIC_FIELDS.some((field) => metrics?.[field] !== undefined)
}

export function buildSupplierRiskMap(riskScores = []) {
  return ensureArray(riskScores).reduce((riskMap, risk) => {
    if (risk?.supplier_id) {
      riskMap.set(risk.supplier_id, risk)
    }

    return riskMap
  }, new Map())
}

export function getRiskDistribution(riskScores = []) {
  const counts = { ...EMPTY_COUNTS }

  ensureArray(riskScores).forEach((risk) => {
    const level = normalizeRiskLevel(risk?.risk_level)
    counts[level] = (counts[level] || 0) + 1
  })

  const total = Object.values(counts).reduce((sum, count) => sum + count, 0)

  return [
    { key: RISK_LEVELS.LOW, label: 'Low', count: counts.low, colorClass: 'bg-risk-safe' },
    { key: RISK_LEVELS.MEDIUM, label: 'Amber', count: counts.medium, colorClass: 'bg-risk-medium' },
    { key: RISK_LEVELS.HIGH, label: 'Red', count: counts.high, colorClass: 'bg-risk-high' },
    { key: RISK_LEVELS.UNKNOWN, label: 'Unknown', count: counts.unknown, colorClass: 'bg-cg-secondary' },
  ].map((item) => ({
    ...item,
    percent: total > 0 ? Math.round((item.count / total) * 100) : 0,
  }))
}

export function getInventorySummary(inventory = []) {
  const rows = ensureArray(inventory)
  const totalStock = rows.reduce((sum, item) => sum + Number(item?.current_stock || 0), 0)
  const safetyStock = rows.reduce((sum, item) => sum + Number(item?.safety_stock || 0), 0)
  const lowStockItems = rows.filter(
    (item) =>
      Number.isFinite(Number(item?.current_stock)) &&
      Number.isFinite(Number(item?.safety_stock)) &&
      Number(item.current_stock) < Number(item.safety_stock),
  ).length
  const warehouses = new Set(rows.map((item) => item?.warehouse).filter(Boolean)).size

  return {
    itemCount: rows.length,
    totalStock,
    safetyStock,
    lowStockItems,
    warehouses,
  }
}

export function getLogisticsSummary(logistics = []) {
  const rows = ensureArray(logistics)
  const methods = rows.reduce((counts, route) => {
    const method = route?.transport_method || 'Unspecified'
    counts[method] = (counts[method] || 0) + 1
    return counts
  }, {})
  const transitValues = rows
    .map((route) => Number(route?.transit_time_days))
    .filter((value) => Number.isFinite(value))
  const averageTransitDays =
    transitValues.length > 0
      ? transitValues.reduce((sum, value) => sum + value, 0) / transitValues.length
      : null

  return {
    routeCount: rows.length,
    countries: new Set(
      rows
        .flatMap((route) => [route?.origin_country, route?.destination_country])
        .filter(Boolean),
    ).size,
    topMethods: Object.entries(methods)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4),
    averageTransitDays,
  }
}

export function getHighRiskSuppliers(suppliers = [], riskScores = []) {
  const riskMap = buildSupplierRiskMap(riskScores)

  return ensureArray(suppliers)
    .map((supplier) => {
      const risk = riskMap.get(supplier?.supplier_id)

      return {
        ...supplier,
        risk_level: risk?.risk_level || supplier?.criticality,
        risk_probability: risk?.risk_probability,
        business_impact: risk?.business_impact,
      }
    })
    .filter((supplier) => normalizeRiskLevel(supplier.risk_level) === RISK_LEVELS.HIGH)
    .sort((a, b) => Number(b.risk_probability || 0) - Number(a.risk_probability || 0))
    .slice(0, 6)
}

export function getOverviewStatus({ riskDistribution, inventorySummary, news = [] }) {
  const highRisk = riskDistribution.find((item) => item.key === RISK_LEVELS.HIGH)?.count || 0
  const amberRisk = riskDistribution.find((item) => item.key === RISK_LEVELS.MEDIUM)?.count || 0
  const activeNews = ensureArray(news).filter((item) =>
    String(item?.status || '').toLowerCase().includes('active'),
  ).length

  if (highRisk > 0 || inventorySummary.lowStockItems > 0) {
    return {
      label: 'Elevated exposure',
      level: 'high',
      detail: `${highRisk} high-risk suppliers and ${inventorySummary.lowStockItems} low-stock inventory items require attention.`,
    }
  }

  if (amberRisk > 0 || activeNews > 0) {
    return {
      label: 'Watch list active',
      level: 'medium',
      detail: `${amberRisk} amber suppliers and ${activeNews} active news events are being monitored.`,
    }
  }

  return {
    label: 'Stable operations',
    level: 'low',
    detail: 'No high-risk supplier exposure or low-stock inventory exceptions are currently visible.',
  }
}
