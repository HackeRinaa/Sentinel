import type { Incident } from '@sentinel/shared';

export function sampleIncident(overrides: Partial<Incident> = {}): Incident {
  return {
    id: 'inc-1',
    externalId: 'demo-eq-ridgecrest',
    source: 'demo',
    type: 'EARTHQUAKE',
    title: 'M 5.4 - 14 km NE of Ridgecrest, CA',
    description: 'Simulated scenario. A magnitude 5.4 earthquake occurred near Ridgecrest.',
    latitude: 35.72,
    longitude: -117.55,
    severity: 'HIGH',
    magnitude: 5.4,
    confidence: null,
    status: 'ACTIVE',
    occurredAt: '2026-10-05T11:42:00.000Z',
    updatedAt: '2026-10-05T11:42:00.000Z',
    createdAt: '2026-10-05T11:42:00.000Z',
    resolvedAt: null,
    sourceUrl: 'https://earthquake.usgs.gov/earthquakes/map/',
    metadata: { place: '14 km NE of Ridgecrest, CA', simulated: true },
    ...overrides,
  };
}
