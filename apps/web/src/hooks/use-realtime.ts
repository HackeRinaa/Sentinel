import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { TYPE_LABELS, type Incident, type RealtimeEvent } from '@sentinel/shared';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { incidentMatchesDashboard, type DashboardFilters } from '@/lib/filters';
import { formatMetric } from '@/lib/format';
import { applyIncidentEvent, type IncidentPage } from '@/services/realtime-cache';
import { startRealtime } from '@/services/realtime';
import { useConnectionStore } from '@/stores/connection-store';
import { useLiveStore } from '@/stores/live-store';
import { useSelectionStore } from '@/stores/selection-store';

const pendingToasts: Incident[] = [];
let toastTimer: number | null = null;

function queueCreatedToast(incident: Incident): void {
  pendingToasts.push(incident);
  if (toastTimer !== null) {
    return;
  }
  toastTimer = window.setTimeout(() => {
    const items = pendingToasts.splice(0);
    toastTimer = null;
    const first = items[0];
    if (!first) {
      return;
    }
    if (items.length === 1) {
      toast.info(first.title, {
        description: `${TYPE_LABELS[first.type]} · ${formatMetric(first)}`,
      });
      return;
    }
    toast.info(`${items.length} new incidents`, {
      description: items
        .slice(0, 3)
        .map((item) => item.title)
        .join(', '),
    });
  }, 400);
}

function isDashboardFilters(value: unknown): value is DashboardFilters {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'types' in value &&
    'debouncedSearch' in value &&
    'limitToMapView' in value,
  );
}

function patchCollection(
  queryClient: QueryClient,
  event: RealtimeEvent,
  root: 'list' | 'map',
): void {
  if (event.type === 'SYSTEM_STATUS') {
    return;
  }
  const entries = queryClient.getQueriesData<IncidentPage>({ queryKey: ['incidents', root] });
  for (const [key, page] of entries) {
    const filters = key[2];
    if (!page || !isDashboardFilters(filters)) {
      continue;
    }
    queryClient.setQueryData(
      key,
      applyIncidentEvent(page, event, (incident) => incidentMatchesDashboard(incident, filters)),
    );
  }
}

export function handleRealtimeEvent(queryClient: QueryClient, event: RealtimeEvent): void {
  if (event.type === 'SYSTEM_STATUS') {
    queryClient.setQueryData(['system', 'providers'], event.payload);
    return;
  }
  patchCollection(queryClient, event, 'list');
  patchCollection(queryClient, event, 'map');
  void queryClient.invalidateQueries({ queryKey: ['incidents', 'stats'] });
  if (event.type === 'INCIDENT_CREATED' || event.type === 'INCIDENT_UPDATED') {
    void queryClient.invalidateQueries({
      queryKey: ['incidents', 'detail', event.payload.incident.id],
    });
  }
  if (event.type === 'INCIDENT_CREATED') {
    useLiveStore.getState().push(event.payload.incident.id);
    queueCreatedToast(event.payload.incident);
  }
  if (event.type === 'INCIDENT_UPDATED') {
    useLiveStore.getState().push(event.payload.incident.id);
  }
  if (
    event.type === 'INCIDENT_REMOVED' &&
    useSelectionStore.getState().selectedId === event.payload.incident.id
  ) {
    useSelectionStore.getState().select(null);
  }
}

export function useRealtimeSync(): void {
  const queryClient = useQueryClient();
  const status = useConnectionStore((state) => state.status);
  const previous = useRef(status);

  useEffect(() => {
    return startRealtime({
      onStatus: (next) => useConnectionStore.getState().setStatus(next),
      onEvent: (event) => handleRealtimeEvent(queryClient, event),
    });
  }, [queryClient]);

  useEffect(() => {
    if (previous.current !== 'connected' && status === 'connected') {
      void queryClient.invalidateQueries({ queryKey: ['incidents'] });
      void queryClient.invalidateQueries({ queryKey: ['system'] });
    }
    previous.current = status;
  }, [queryClient, status]);
}
