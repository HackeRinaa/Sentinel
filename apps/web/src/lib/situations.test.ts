import { buildSituationBrief, findSituations } from '@sentinel/shared';
import { describe, expect, it } from 'vitest';
import { sampleIncident } from '@/test/fixtures';

const now = new Date('2026-10-07T12:00:00.000Z');

describe('compound situations', () => {
  it('links a high wildfire to a nearby earthquake and ignores same-type pairs', () => {
    const quake = sampleIncident({
      id: 'quake',
      latitude: 35.72,
      longitude: -117.55,
      magnitude: 5.4,
    });
    const fire = sampleIncident({
      id: 'fire',
      externalId: 'demo-fire-angeles',
      type: 'WILDFIRE',
      title: 'Angeles National Forest fire - California',
      severity: 'HIGH',
      magnitude: null,
      confidence: 0.62,
      latitude: 34.27,
      longitude: -118.05,
    });
    const distant = sampleIncident({
      id: 'storm',
      externalId: 'demo-storm-luzon',
      type: 'STORM',
      title: 'Typhoon warning - east of Luzon, Philippines',
      latitude: 15.2,
      longitude: 124.2,
      magnitude: null,
    });
    const otherQuake = sampleIncident({
      id: 'other-quake',
      externalId: 'demo-eq-athens',
      latitude: 37.94,
      longitude: 23.68,
    });

    const situations = findSituations([quake, fire, distant, otherQuake]);
    expect(situations).toHaveLength(1);
    expect(situations[0]?.primaryId).toBe('fire');
    expect(situations[0]?.secondaryId).toBe('quake');
    expect(situations[0]?.summary).toMatch(/wildfire \d+ km from an M 5\.4/);
  });

  it('writes a brief from critical count, the newest incident, and the lead situation', () => {
    const critical = sampleIncident({
      id: 'critical',
      severity: 'CRITICAL',
      magnitude: 6.8,
      title: 'M 6.8 - Kamchatka',
      occurredAt: '2026-10-07T11:00:00.000Z',
    });
    const newest = sampleIncident({
      id: 'newest',
      title: 'M 5.7 - Ridgecrest',
      occurredAt: '2026-10-07T11:50:00.000Z',
    });
    const brief = buildSituationBrief(
      [critical, newest],
      [
        {
          id: 'a:b',
          primaryId: 'critical',
          secondaryId: 'newest',
          distanceKm: 28,
          severity: 'CRITICAL',
          summary: 'Critical earthquake 28 km from a wildfire',
        },
      ],
      now,
    );
    expect(brief).toContain('1 critical.');
    expect(brief).toContain('Newest: M 5.7 - Ridgecrest, 10 minutes ago.');
    expect(brief).toContain('Compound situation: Critical earthquake 28 km from a wildfire.');
  });
});
