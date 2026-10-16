import type { IncidentType, Severity } from '@sentinel/shared';
import { create } from 'zustand';
import { emptyFilters, sameBbox, type DashboardFilters } from '@/lib/filters';
import type { BoundingBox } from '@sentinel/shared';

interface FilterState extends DashboardFilters {
  setSearch: (search: string) => void;
  setDebouncedSearch: (debouncedSearch: string) => void;
  toggleType: (type: IncidentType) => void;
  toggleSeverity: (severity: Severity) => void;
  toggleSource: (source: string) => void;
  setStartDate: (startDate: string) => void;
  setEndDate: (endDate: string) => void;
  setLimitToMapView: (limitToMapView: boolean) => void;
  setBbox: (bbox: BoundingBox | null) => void;
  clear: () => void;
}

function toggleValue<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export const useFilterStore = create<FilterState>((set, get) => ({
  ...emptyFilters,
  setSearch: (search) => set({ search }),
  setDebouncedSearch: (debouncedSearch) => set({ debouncedSearch }),
  toggleType: (type) => set({ types: toggleValue(get().types, type) }),
  toggleSeverity: (severity) => set({ severities: toggleValue(get().severities, severity) }),
  toggleSource: (source) => set({ sources: toggleValue(get().sources, source) }),
  setStartDate: (startDate) => set({ startDate }),
  setEndDate: (endDate) => set({ endDate }),
  setLimitToMapView: (limitToMapView) =>
    set({ limitToMapView, bbox: limitToMapView ? get().bbox : null }),
  setBbox: (bbox) => {
    if (sameBbox(get().bbox, bbox)) {
      return;
    }
    set({ bbox });
  },
  clear: () => set({ ...emptyFilters }),
}));

export function selectAppliedFilters(state: FilterState): DashboardFilters {
  return {
    types: state.types,
    severities: state.severities,
    sources: state.sources,
    search: state.search,
    debouncedSearch: state.debouncedSearch,
    startDate: state.startDate,
    endDate: state.endDate,
    limitToMapView: state.limitToMapView,
    bbox: state.bbox,
  };
}

export function selectQueryFilters(state: FilterState): DashboardFilters {
  const applied = selectAppliedFilters(state);
  return {
    ...applied,
    search: state.debouncedSearch,
  };
}
