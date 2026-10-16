import { findSituations } from '@sentinel/shared';
import { useEffect, useMemo, useState } from 'react';
import { Sheet } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { IncidentCharts } from '@/features/analytics/IncidentCharts';
import { SituationBrief } from '@/features/analytics/SituationBrief';
import { StatsRow } from '@/features/analytics/StatsRow';
import { FilterBar } from '@/features/incidents/FilterBar';
import { IncidentDetail } from '@/features/incidents/IncidentDetail';
import { IncidentFeed } from '@/features/incidents/IncidentFeed';
import { IncidentMap } from '@/features/map/IncidentMap';
import {
  useIncidentDetail,
  useIncidentList,
  useIncidentStats,
  useMapIncidents,
  useProviderStatus,
} from '@/hooks/use-incidents';
import { useNow } from '@/hooks/use-now';
import { useRealtimeSync } from '@/hooks/use-realtime';
import { countActiveFilters } from '@/lib/filters';
import { Header } from '@/components/layout/Header';
import { useConnectionStore } from '@/stores/connection-store';
import { selectQueryFilters, useFilterStore } from '@/stores/filter-store';
import { useShallow } from 'zustand/react/shallow';
import { useLiveStore } from '@/stores/live-store';
import { useSelectionStore } from '@/stores/selection-store';

export function DashboardPage() {
  useRealtimeSync();
  const now = useNow();
  const [page, setPage] = useState(1);
  const filters = useFilterStore(useShallow(selectQueryFilters));
  const filterKey = JSON.stringify(filters);
  const list = useIncidentList(page);
  const map = useMapIncidents();
  const stats = useIncidentStats();
  const providers = useProviderStatus();
  const selectedId = useSelectionStore((state) => state.selectedId);
  const select = useSelectionStore((state) => state.select);
  const highlightedIds = useLiveStore((state) => state.ids);
  const connection = useConnectionStore((state) => state.status);
  const detail = useIncidentDetail(selectedId);
  const clear = useFilterStore((state) => state.clear);
  const activeFilters = useFilterStore((state) => countActiveFilters(state));

  useEffect(() => {
    setPage(1);
  }, [filterKey]);

  const mapIncidents = map.data?.data ?? [];
  const situations = useMemo(() => findSituations(mapIncidents), [mapIncidents]);
  const related = useMemo(() => {
    if (!selectedId) {
      return [];
    }
    return situations.flatMap((situation) => {
      if (situation.primaryId !== selectedId && situation.secondaryId !== selectedId) {
        return [];
      }
      const otherId =
        situation.primaryId === selectedId ? situation.secondaryId : situation.primaryId;
      const other = mapIncidents.find((incident) => incident.id === otherId);
      return other ? [{ situation, other }] : [];
    });
  }, [mapIncidents, selectedId, situations]);

  const selected =
    mapIncidents.find((incident) => incident.id === selectedId) ??
    list.data?.data.find((incident) => incident.id === selectedId) ??
    detail.data ??
    null;

  return (
    <div className="flex min-h-dvh flex-col xl:h-dvh xl:overflow-hidden">
      <a className="skip-link" href="#incident-feed">
        Skip to incidents
      </a>
      <Header />
      {providers.data?.demoMode ? (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-900 dark:text-amber-100">
          Demo mode: events are simulated for local review and are not official emergency alerts.
        </div>
      ) : null}
      {connection === 'offline' ? (
        <div className="border-b border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm" role="status">
          Live updates are offline. The dashboard will keep trying to reconnect.
        </div>
      ) : null}
      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_400px]">
        <section aria-label="Incident map" className="h-[68vh] min-h-0 xl:h-full">
          {map.isError ? (
            <div
              className="flex h-full min-h-[420px] items-center justify-center p-6 text-sm"
              role="alert"
            >
              The map data could not be loaded.
              <button type="button" className="ml-2 underline" onClick={() => void map.refetch()}>
                Retry
              </button>
            </div>
          ) : map.isLoading && !map.data ? (
            <Skeleton className="h-full min-h-[420px] rounded-none" />
          ) : (
            <IncidentMap
              incidents={map.data?.data ?? []}
              selected={selected}
              onSelect={select}
              now={now}
            />
          )}
        </section>
        <aside
          id="incident-feed"
          className="flex max-h-[70vh] min-h-0 flex-col border-t border-line xl:h-full xl:max-h-none xl:border-l xl:border-t-0"
        >
          <FilterBar />
          <IncidentFeed
            incidents={list.data?.data ?? []}
            isLoading={list.isLoading && !list.data}
            isError={list.isError}
            onRetry={() => void list.refetch()}
            selectedId={selectedId}
            onSelect={select}
            highlightedIds={highlightedIds}
            page={list.data?.meta.page ?? page}
            totalPages={list.data?.meta.totalPages ?? 0}
            total={list.data?.meta.total ?? 0}
            onPageChange={setPage}
            hasActiveFilters={activeFilters > 0}
            onClearFilters={clear}
            now={now}
          />
        </aside>
      </div>
      <section
        aria-label="Incident analytics"
        className="shrink-0 space-y-3 border-t border-line bg-canvas p-3"
      >
        <SituationBrief incidents={mapIncidents} now={now} />
        <StatsRow
          stats={stats.data}
          total={list.data?.meta.total ?? 0}
          isLoading={stats.isLoading}
        />
        <IncidentCharts stats={stats.data} />
      </section>
      <Sheet
        open={Boolean(selectedId)}
        onOpenChange={(open) => {
          if (!open) {
            select(null);
          }
        }}
        title={detail.data?.title ?? selected?.title ?? 'Incident'}
        description="Source record and normalized fields"
      >
        {detail.isLoading && !detail.data ? <Skeleton className="h-40" /> : null}
        {detail.isError ? <p role="alert">Incident details could not be loaded.</p> : null}
        {detail.data ? (
          <IncidentDetail incident={detail.data} related={related} onSelectRelated={select} />
        ) : null}
      </Sheet>
      <div className="sr-only" aria-live="polite">
        {highlightedIds.length > 0 ? `${highlightedIds.length} new incident updates` : ''}
      </div>
    </div>
  );
}
