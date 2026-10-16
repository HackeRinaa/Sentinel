import { beforeEach, describe, expect, it } from 'vitest';
import { countActiveFilters } from '@/lib/filters';
import { useFilterStore } from './filter-store';

describe('filter store', () => {
  beforeEach(() => {
    useFilterStore.getState().clear();
  });

  it('toggles filters and clears them', () => {
    useFilterStore.getState().toggleType('EARTHQUAKE');
    useFilterStore.getState().toggleType('EARTHQUAKE');
    useFilterStore.getState().toggleSeverity('CRITICAL');
    useFilterStore.getState().setSearch('kamchatka');
    expect(useFilterStore.getState().types).toEqual([]);
    expect(countActiveFilters(useFilterStore.getState())).toBe(2);
    useFilterStore.getState().clear();
    expect(countActiveFilters(useFilterStore.getState())).toBe(0);
  });
});
