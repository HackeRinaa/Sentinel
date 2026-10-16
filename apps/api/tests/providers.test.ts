import { describe, expect, it } from 'vitest';
import { normalizeEonetEvent, normalizeEonetFeed } from '../src/providers/eonet.js';
import { advanceDemoState, createInitialDemoState } from '../src/providers/demo-provider.js';
import { dedupeIncidents, hasMaterialChange } from '../src/repositories/change-detection.js';
import { toDomainIncident } from '../src/repositories/change-detection.js';
import { withRetry, withTimeout } from '../src/providers/retry.js';
import { normalizeUsgsFeature, normalizeUsgsFeed } from '../src/providers/usgs.js';
import { makeNormalized } from './helpers.js';

describe('USGS normalization', () => {
  it('maps magnitude to severity and keeps depth metadata', () => {
    const incident = normalizeUsgsFeature({
      id: 'us1000',
      properties: {
        mag: 6.2,
        place: '28 km SE of Petropavlovsk-Kamchatsky, Russia',
        time: Date.parse('2026-10-05T08:00:00.000Z'),
        updated: Date.parse('2026-10-05T08:05:00.000Z'),
        url: 'https://earthquake.usgs.gov/earthquakes/eventpage/us1000',
        title: 'M 6.2 - 28 km SE of Petropavlovsk-Kamchatsky, Russia',
        status: 'reviewed',
        tsunami: 0,
        type: 'earthquake',
        magType: 'mww',
      },
      geometry: { type: 'Point', coordinates: [158.9, 52.8, 36] },
    });

    expect(incident?.severity).toBe('CRITICAL');
    expect(incident?.magnitude).toBe(6.2);
    expect(incident?.source).toBe('usgs');
    expect(incident?.metadata.depthKm).toBe(36);
    expect(incident?.metadata.tsunami).toBe(false);
    expect(incident?.latitude).toBe(52.8);
    expect(incident?.longitude).toBe(158.9);
  });

  it('skips blasts, missing geometry, and invalid records without failing the feed', () => {
    const result = normalizeUsgsFeed({
      features: [
        { id: 'bad' },
        {
          id: 'blast-1',
          properties: {
            mag: 2.1,
            place: 'quarry',
            time: Date.now(),
            title: 'Quarry blast',
            type: 'quarry blast',
          },
          geometry: { type: 'Point', coordinates: [-122, 37, 0] },
        },
        {
          id: 'eq-1',
          properties: {
            mag: 3.2,
            place: 'Test',
            time: Date.parse('2026-10-05T01:00:00.000Z'),
            title: 'M 3.2 - Test',
            type: 'earthquake',
          },
          geometry: { type: 'Point', coordinates: [-122.4, 37.8, 8] },
        },
      ],
    });

    expect(result.incidents).toHaveLength(1);
    expect(result.incidents[0]?.externalId).toBe('eq-1');
    expect(result.incidents[0]?.severity).toBe('MODERATE');
    expect(result.skipped).toBe(2);
  });

  it('rejects an unexpected envelope', () => {
    expect(() => normalizeUsgsFeed({ metadata: {} })).toThrow(/USGS response/);
  });
});

describe('EONET normalization', () => {
  it('maps wildfires, storms, and the latest point', () => {
    const wildfire = normalizeEonetEvent({
      id: 'EONET_1',
      title: 'Wildfire - Sonoma County, California',
      description: null,
      link: 'https://eonet.gsfc.nasa.gov/api/v3/events/EONET_1',
      closed: null,
      categories: [{ id: 'wildfires', title: 'Wildfires' }],
      sources: [{ id: 'InciWeb', url: 'https://inciweb.wildfire.gov/example' }],
      geometry: [
        { date: '2026-10-01T00:00:00Z', type: 'Point', coordinates: [-122.5, 38.4] },
        { date: '2026-10-04T00:00:00Z', type: 'Point', coordinates: [-122.8, 38.5] },
      ],
    });
    expect(wildfire?.type).toBe('WILDFIRE');
    expect(wildfire?.latitude).toBe(38.5);
    expect(wildfire?.longitude).toBe(-122.8);
    expect(wildfire?.metadata.place).toBe('Sonoma County, California');

    const storm = normalizeEonetEvent({
      id: 'EONET_2',
      title: 'Typhoon - east of Luzon',
      categories: [{ id: 'severeStorms', title: 'Severe Storms' }],
      geometry: [{ date: '2026-10-05T00:00:00Z', type: 'Point', coordinates: [124.4, 15.2] }],
    });
    expect(storm?.severity).toBe('CRITICAL');
    expect(storm?.type).toBe('STORM');
  });

  it('skips unmapped categories and events without a point', () => {
    const result = normalizeEonetFeed({
      events: [
        {
          id: 'snow',
          title: 'Snow - Alps',
          categories: [{ id: 'snow', title: 'Snow' }],
          geometry: [{ date: '2026-10-05T00:00:00Z', type: 'Point', coordinates: [8, 46] }],
        },
        {
          id: 'poly',
          title: 'Wildfire - polygon only',
          categories: [{ id: 'wildfires', title: 'Wildfires' }],
          geometry: [{ date: '2026-10-05T00:00:00Z', type: 'Polygon', coordinates: [] }],
        },
      ],
    });
    expect(result.incidents).toHaveLength(0);
    expect(result.skipped).toBe(2);
  });
});

describe('deduplication and change detection', () => {
  it('keeps the latest event when a fetch repeats an external id', () => {
    const older = makeNormalized({
      occurredAt: new Date('2026-10-05T01:00:00.000Z'),
      title: 'old',
    });
    const newer = makeNormalized({
      occurredAt: new Date('2026-10-05T02:00:00.000Z'),
      title: 'new',
    });
    const deduped = dedupeIncidents([older, newer]);
    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.title).toBe('new');
  });

  it('ignores tiny magnitude noise and detects a real revision', () => {
    const existing = toDomainIncident('id-1', makeNormalized(), {
      createdAt: new Date('2026-10-05T12:00:00.000Z'),
      updatedAt: new Date('2026-10-05T12:00:00.000Z'),
      resolvedAt: null,
    });
    expect(hasMaterialChange(existing, makeNormalized({ magnitude: 4.52 }))).toBe(false);
    expect(hasMaterialChange(existing, makeNormalized({ magnitude: 4.8 }))).toBe(true);
  });
});

describe('retry and timeout', () => {
  it('retries with exponential backoff and then returns the value', async () => {
    const delays: number[] = [];
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls += 1;
        if (calls < 3) {
          throw new Error('temporary');
        }
        return 'ok';
      },
      {
        retries: 3,
        baseDelayMs: 100,
        maxDelayMs: 1_000,
        sleep: async (milliseconds) => {
          delays.push(milliseconds);
        },
      },
    );
    expect(result).toBe('ok');
    expect(calls).toBe(3);
    expect(delays).toEqual([100, 200]);
  });

  it('times out a hung operation', async () => {
    await expect(withTimeout(new Promise(() => undefined), 20, 'provider')).rejects.toThrow(
      /timed out/,
    );
  });
});

describe('demo simulation', () => {
  it('plays a Ridgecrest revision, an aftershock, then a critical fire', () => {
    const now = new Date('2026-10-07T12:00:00.000Z');
    let state = createInitialDemoState(now);
    expect(
      state.active.find((incident) => incident.externalId === 'demo-eq-ridgecrest')?.magnitude,
    ).toBe(5.4);
    expect(
      state.active.find((incident) => incident.externalId === 'demo-fire-angeles')?.severity,
    ).toBe('HIGH');

    state = advanceDemoState(state, new Date('2026-10-07T12:00:15.000Z'), () => 0);
    expect(
      state.active.find((incident) => incident.externalId === 'demo-eq-ridgecrest')?.magnitude,
    ).toBe(5.7);

    state = advanceDemoState(state, new Date('2026-10-07T12:00:30.000Z'), () => 0);
    expect(state.active.some((incident) => incident.externalId === 'demo-aftershock-1')).toBe(true);

    state = advanceDemoState(state, new Date('2026-10-07T12:00:45.000Z'), () => 0);
    expect(
      state.active.find((incident) => incident.externalId === 'demo-fire-angeles')?.severity,
    ).toBe('CRITICAL');
    expect(state.beat).toBe(3);
  });

  it('adds an emerging incident and revises an existing one', () => {
    const now = new Date('2026-10-05T12:00:00.000Z');
    let initial = createInitialDemoState(now);
    for (let beat = 0; beat < 3; beat += 1) {
      initial = advanceDemoState(initial, new Date(now.getTime() + (beat + 1) * 15_000), () => 0);
    }
    const random = sequence([0, 0, 0.99]);
    const next = advanceDemoState(initial, new Date('2026-10-05T12:15:00.000Z'), random);
    expect(next.active.length).toBe(initial.active.length + 1);
    expect(next.active.some((incident) => incident.externalId === 'demo-eq-crete')).toBe(true);
    expect(
      next.active.some(
        (incident) =>
          incident.description.includes('Revised') ||
          incident.description.includes('Containment') ||
          incident.description.includes('Situation update'),
      ),
    ).toBe(true);
  });
});

function sequence(values: number[]): () => number {
  let index = 0;
  return () => {
    const value = values[index] ?? 0;
    index += 1;
    return value;
  };
}
