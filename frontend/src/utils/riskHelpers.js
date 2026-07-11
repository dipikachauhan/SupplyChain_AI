export const RISK_LEVELS = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  UNKNOWN: 'unknown',
}

export function normalizeRiskLevel(level) {
  if (!level) return RISK_LEVELS.UNKNOWN

  const normalized = String(level).toLowerCase()

  if (normalized.includes('high')) return RISK_LEVELS.HIGH
  if (normalized.includes('medium') || normalized.includes('med')) {
    return RISK_LEVELS.MEDIUM
  }
  if (normalized.includes('low')) return RISK_LEVELS.LOW

  return RISK_LEVELS.UNKNOWN
}

export function getRiskStyles(level) {
  const normalized = normalizeRiskLevel(level)

  switch (normalized) {
    case RISK_LEVELS.HIGH:
      return {
        badge: 'bg-risk-high/15 text-risk-high border-risk-high/30',
        dot: 'bg-risk-high',
        label: 'High Risk',
      }
    case RISK_LEVELS.MEDIUM:
      return {
        badge: 'bg-risk-medium/15 text-risk-medium border-risk-medium/30',
        dot: 'bg-risk-medium',
        label: 'Medium Risk',
      }
    case RISK_LEVELS.LOW:
      return {
        badge: 'bg-risk-safe/15 text-risk-safe border-risk-safe/30',
        dot: 'bg-risk-safe',
        label: 'Low Risk',
      }
    default:
      return {
        badge: 'bg-cg-secondary/15 text-cg-secondary border-cg-secondary/30',
        dot: 'bg-cg-secondary',
        label: 'Unknown',
      }
  }
}

export function getCriticalityStyles(criticality) {
  return getRiskStyles(criticality)
}

export function getSeverityStyles(severity) {
  return getRiskStyles(severity)
}
