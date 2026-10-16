import { describe, expect, it } from 'vitest';
import type { RealtimeEvent } from '@sentinel/shared';
import { emptyFilters, incidentMatchesDashboard } from '@/lib/filters';
import { sampleIncident } from '@/test/fixtures';
import { applyIncidentEvent, type IncidentPage } from './realtime-cache';

const page: IncidentPage = {
  data: [sampleIncident()],
  meta: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
};

const matches = (incident: ReturnType<typeof sampleIncident>) =>
  incidentMatchesDashboard(incident, emptyFilters);

describe('realtime cache updates', () => {
  it('prepends a created incident and grows the total', () => {
    const created = sampleIncident({ id: 'inc-2', title: 'M 4.4 - Crete' });
    const next = applyIncidentEvent(page, event('INCIDENT_CREATED', created), matches);
    expect(next?.data.map((incident) => incident.id)).toEqual(['inc-2', 'inc-1']);
    expect(next?.meta.total).toBe(2);
  });

  it('replaces an updated incident without duplicating it', () => {
    const updated = sampleIncident({ title: 'M 5.5 - revised', magnitude: 5.5 });
    const next = applyIncidentEvent(page, event('INCIDENT_UPDATED', updated), matches);
    expect(next?.data).toHaveLength(1);
    expect(next?.data[0]?.title).toBe('M 5.5 - revised');
    expect(next?.meta.total).toBe(1);
  });

  it('removes a resolved incident from the active page', () => {
    const removed = sampleIncident({ status: 'RESOLVED' });
    const next = applyIncidentEvent(page, event('INCIDENT_REMOVED', removed), matches);
    expect(next?.data).toHaveLength(0);
    expect(next?.meta.total).toBe(0);
  });

  it('leaves a wildfire-only cache unchanged when an earthquake is created', () => {
    const filters = { ...emptyFilters, types: ['WILDFIRE' as const] };
    const next = applyIncidentEvent(
      { data: [], meta: { page: 1, pageSize: 50, total: 0, totalPages: 0 } },
      event('INCIDENT_CREATED', sampleIncident()),
      (incident) => incidentMatchesDashboard(incident, filters),
    );
    expect(next?.data).toHaveLength(0);
    expect(next?.meta.total).toBe(0);
  });
});

function event(
  type: 'INCIDENT_CREATED' | 'INCIDENT_UPDATED' | 'INCIDENT_REMOVED',
  incident: ReturnType<typeof sampleIncident>,
): Extract<RealtimeEvent, { type: typeof type }> {
  return {
    type,
    timestamp: '2026-10-05T12:05:00.000Z',
    payload: { incident },
  };
}
