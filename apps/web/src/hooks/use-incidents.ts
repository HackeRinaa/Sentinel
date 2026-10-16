import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useShallow } from 'zustand/react/shallow';
import {
  fetchHealth,
  fetchIncident,
  fetchIncidents,
  fetchProviderStatus,
  fetchStats,
} from '@/services/api';
import { selectQueryFilters, useFilterStore } from '@/stores/filter-store';

export function useAppliedFilters() {
  return useFilterStore(useShallow(selectQueryFilters));
}

export function useIncidentList(page: number) {
  const filters = useAppliedFilters();
  return useQuery({
    queryKey: ['incidents', 'list', filters, page],
    queryFn: ({ signal }) => fetchIncidents(filters, page, 50, signal),
    placeholderData: keepPreviousData,
  });
}

export function useMapIncidents() {
  const filters = useAppliedFilters();
  return useQuery({
    queryKey: ['incidents', 'map', filters],
    queryFn: ({ signal }) => fetchIncidents(filters, 1, 500, signal),
    placeholderData: keepPreviousData,
  });
}

export function useIncidentStats() {
  const filters = useAppliedFilters();
  return useQuery({
    queryKey: ['incidents', 'stats', filters],
    queryFn: ({ signal }) => fetchStats(filters, signal),
    placeholderData: keepPreviousData,
  });
}

export function useIncidentDetail(id: string | null) {
  return useQuery({
    queryKey: ['incidents', 'detail', id],
    queryFn: ({ signal }) => fetchIncident(id ?? '', signal),
    enabled: Boolean(id),
  });
}

export function useHealth() {
  return useQuery({
    queryKey: ['system', 'health'],
    queryFn: ({ signal }) => fetchHealth(signal),
    refetchInterval: 30_000,
    retry: 1,
  });
}

export function useProviderStatus() {
  return useQuery({
    queryKey: ['system', 'providers'],
    queryFn: ({ signal }) => fetchProviderStatus(signal),
    refetchInterval: 30_000,
  });
}
