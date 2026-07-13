import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card } from '../common'

const SEVERITY_COLORS = { High: 'var(--color-risk-high)', Medium: 'var(--color-risk-medium)', Low: 'var(--color-risk-safe)' }
const TOOLTIP_STYLE = { background: 'var(--color-cg-card)', border: '1px solid var(--color-cg-border)', borderRadius: '8px' }
const TOOLTIP_TEXT = { color: 'var(--color-cg-text)' }
const LEGEND_STYLE = { color: 'var(--color-cg-muted)', fontSize: 12 }

export default function NewsCharts({ events }) {
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

  const monthData = Object.values(
    events.reduce((result, event) => {
      if (!event.date) return result
      const month = String(event.date).slice(0, 7)
      result[month] = result[month] || { name: month, events: 0 }
      result[month].events += 1
      return result
    }, {}),
  ).sort((a, b) => String(a.name).localeCompare(String(b.name)))

  const colors = ['var(--color-cg-primary)', 'var(--color-cg-secondary)', 'var(--color-risk-safe)', 'var(--color-risk-medium)', 'var(--color-risk-high)', 'var(--color-cg-chart-series-muted)']

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
                contentStyle={TOOLTIP_STYLE}
                labelStyle={TOOLTIP_TEXT}
                itemStyle={TOOLTIP_TEXT}
              />
              <Legend wrapperStyle={LEGEND_STYLE} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-cg-text">Category distribution</h2>
        <p className="mt-1 text-sm text-cg-muted">Risk categories driving the largest volume of events.</p>
        <div className="mt-5 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={92} paddingAngle={3}>
                {categoryData.map((item, index) => (
                  <Cell key={item.name} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={TOOLTIP_TEXT}
                itemStyle={TOOLTIP_TEXT}
              />
              <Legend wrapperStyle={LEGEND_STYLE} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-cg-text">Monthly event trend</h2>
        <p className="mt-1 text-sm text-cg-muted">How event volume has changed over time.</p>
        <div className="mt-5 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthData} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-cg-chart-grid)" strokeDasharray="3 3" horizontal={false} />
              <XAxis dataKey="name" tick={{ fill: 'var(--color-cg-chart-axis)', fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: 'var(--color-cg-chart-axis)', fontSize: 12 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={TOOLTIP_TEXT}
                itemStyle={TOOLTIP_TEXT}
              />
              <Legend wrapperStyle={LEGEND_STYLE} />
              <Line type="monotone" dataKey="events" name="Events" stroke="var(--color-cg-primary)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  )
}
