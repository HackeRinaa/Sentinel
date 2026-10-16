import {
  SEVERITY_COLORS,
  SEVERITY_LABELS,
  TYPE_COLORS,
  TYPE_LABELS,
  type IncidentStats,
} from '@sentinel/shared';
import type { ReactNode } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useThemeStore } from '@/stores/theme-store';

export function IncidentCharts({ stats }: { stats: IncidentStats | undefined }) {
  const theme = useThemeStore((state) => state.theme);
  const axis = theme === 'dark' ? '#93a4bd' : '#526277';
  const grid = theme === 'dark' ? 'rgba(148,163,184,0.16)' : 'rgba(15,23,42,0.08)';
  const tooltipStyle = {
    background: theme === 'dark' ? '#101826' : '#ffffff',
    border: '1px solid rgba(148,163,184,0.3)',
    borderRadius: 8,
    color: theme === 'dark' ? '#e7eef8' : '#0f172a',
  };

  if (!stats) {
    return null;
  }

  const typeData = stats.byType.map((entry) => ({
    label: TYPE_LABELS[entry.type],
    count: entry.count,
    fill: TYPE_COLORS[entry.type],
  }));
  const severityData = stats.bySeverity.map((entry) => ({
    label: SEVERITY_LABELS[entry.severity],
    count: entry.count,
    fill: SEVERITY_COLORS[entry.severity],
  }));
  const timeline = stats.timeline.map((entry) => ({
    label: entry.bucket.slice(5),
    count: entry.count,
  }));

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <ChartCard title="Active by type" description="Current picture, not historical volume.">
        <ResponsiveContainer width="100%" height={148}>
          <BarChart data={typeData}>
            <CartesianGrid stroke={grid} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: axis, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: axis, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={28}
            />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {typeData.map((entry) => (
                <Cell key={entry.label} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Active by severity" description="Color is paired with the severity name.">
        <ResponsiveContainer width="100%" height={148}>
          <BarChart data={severityData}>
            <CartesianGrid stroke={grid} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: axis, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: axis, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={28}
            />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {severityData.map((entry) => (
                <Cell key={entry.label} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard
        title="Incidents over time"
        description="Occurrences by UTC day in the selected window."
      >
        <ResponsiveContainer width="100%" height={148}>
          <AreaChart data={timeline}>
            <CartesianGrid stroke={grid} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: axis, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: axis, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={28}
            />
            <Tooltip contentStyle={tooltipStyle} />
            <Area
              type="monotone"
              dataKey="count"
              stroke="#2dd4bf"
              fill="rgba(45,212,191,0.25)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line bg-panel p-3 shadow-[var(--shadow)]">
      <h3 className="text-sm font-medium">{title}</h3>
      <p className="mb-2 text-xs text-subtle">{description}</p>
      {children}
    </section>
  );
}
