import type { IncidentStats } from '@sentinel/shared';
import { Activity, AlertTriangle, Clock3, Radar } from 'lucide-react';
import type { ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export function StatsRow({
  stats,
  total,
  isLoading,
}: {
  stats: IncidentStats | undefined;
  total: number;
  isLoading: boolean;
}) {
  if (isLoading && !stats) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-20" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Active incidents"
        value={stats?.active ?? 0}
        icon={<Radar className="h-4 w-4" />}
      />
      <StatCard
        label="Critical"
        value={stats?.critical ?? 0}
        icon={<AlertTriangle className="h-4 w-4" />}
      />
      <StatCard
        label="Last 24 hours"
        value={stats?.last24h ?? 0}
        icon={<Clock3 className="h-4 w-4" />}
      />
      <StatCard label="Matching filters" value={total} icon={<Activity className="h-4 w-4" />} />
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return (
    <article className="rounded-xl border border-line bg-panel px-4 py-3 shadow-[var(--shadow)]">
      <div className="flex items-center justify-between text-subtle">
        <h3 className="text-xs font-medium uppercase tracking-[0.14em]">{label}</h3>
        {icon}
      </div>
      <p className="mt-2 font-mono text-2xl font-semibold tracking-tight">
        {value.toLocaleString()}
      </p>
    </article>
  );
}
