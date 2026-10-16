import { describe, expect, it } from 'vitest';
import { countActiveFilters, emptyFilters, incidentMatchesDashboard } from './filters';
import { sampleIncident } from '@/test/fixtures';

describe('dashboard filters', () => {
  it('counts each active dimension once', () => {
    expect(
      countActiveFilters({
        ...emptyFilters,
        types: ['EARTHQUAKE'],
        severities: ['HIGH'],
        search: 'ridgecrest',
        limitToMapView: true,
      }),
    ).toBe(4);
    expect(countActiveFilters(emptyFilters)).toBe(0);
  });

  it('matches type, severity, search, and map bounds', () => {
    const incident = sampleIncident();
    expect(incidentMatchesDashboard(incident, emptyFilters)).toBe(true);
    expect(incidentMatchesDashboard(incident, { ...emptyFilters, types: ['WILDFIRE'] })).toBe(
      false,
    );
    expect(
      incidentMatchesDashboard(incident, { ...emptyFilters, debouncedSearch: 'ridgecrest' }),
    ).toBe(true);
    expect(
      incidentMatchesDashboard(incident, {
        ...emptyFilters,
        limitToMapView: true,
        bbox: { minLat: 0, maxLat: 1, minLng: 0, maxLng: 1 },
      }),
    ).toBe(false);
  });
});
