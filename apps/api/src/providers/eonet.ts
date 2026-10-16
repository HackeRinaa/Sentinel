import {
  isValidCoordinate,
  sanitizeHttpUrl,
  type IncidentType,
  type Severity,
} from '@sentinel/shared';
import { z } from 'zod';
import { clampText } from '../utils/text.js';
import { fetchJson } from './http.js';
import type { IncidentProvider, NormalizedIncident, ProviderFetchResult } from './types.js';

/**
 * NASA EONET is the default wildfire and severe-weather source because it is
 * public, key-free, and event-level. FIRMS thermal hotspots need a MAP key and
 * a world/day extract is too granular for an incident feed.
 */
const categoryMap: Record<string, { type: IncidentType; severity: Severity }> = {
  wildfires: { type: 'WILDFIRE', severity: 'HIGH' },
  severeStorms: { type: 'STORM', severity: 'HIGH' },
  floods: { type: 'FLOOD', severity: 'MODERATE' },
  volcanoes: { type: 'OTHER', severity: 'CRITICAL' },
  landslides: { type: 'OTHER', severity: 'MODERATE' },
};

const eventSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  link: z.string().optional(),
  closed: z.string().nullable().optional(),
  categories: z.array(z.object({ id: z.string(), title: z.string() })).default([]),
  sources: z
    .array(z.object({ id: z.string(), url: z.string().optional() }))
    .optional()
    .default([]),
  geometry: z
    .array(
      z.object({
        date: z.string(),
        type: z.string(),
        coordinates: z.array(z.number()),
      }),
    )
    .default([]),
});

const feedSchema = z.object({
  events: z.array(z.unknown()),
});

export function normalizeEonetFeed(payload: unknown): ProviderFetchResult {
  const feed = feedSchema.safeParse(payload);
  if (!feed.success) {
    throw new Error('EONET response did not match the expected events schema');
  }
  const incidents: NormalizedIncident[] = [];
  let skipped = 0;
  for (const event of feed.data.events) {
    const normalized = normalizeEonetEvent(event);
    if (!normalized) {
      skipped += 1;
      continue;
    }
    incidents.push(normalized);
  }
  return { incidents, skipped };
}

export function normalizeEonetEvent(event: unknown): NormalizedIncident | null {
  const parsed = eventSchema.safeParse(event);
  if (!parsed.success) {
    return null;
  }
  const category = parsed.data.categories
    .map((entry) => categoryMap[entry.id])
    .find((entry) => entry !== undefined);
  if (!category) {
    return null;
  }
  const point = latestPoint(parsed.data.geometry);
  if (!point || !isValidCoordinate(point.latitude, point.longitude)) {
    return null;
  }
  const occurredAt = new Date(point.date);
  if (Number.isNaN(occurredAt.getTime())) {
    return null;
  }

  const place = placeFromTitle(parsed.data.title);
  const severity = category.type === 'STORM' ? stormSeverity(parsed.data.title) : category.severity;
  const sourceUrl =
    sanitizeHttpUrl(parsed.data.sources[0]?.url) ?? sanitizeHttpUrl(parsed.data.link);
  const description =
    parsed.data.description?.trim() ||
    `${parsed.data.title}. Open natural event reported by NASA EONET.`;

  return {
    externalId: parsed.data.id,
    source: 'eonet',
    type: category.type,
    title: clampText(parsed.data.title, 300),
    description: clampText(description, 4000),
    latitude: point.latitude,
    longitude: point.longitude,
    severity,
    magnitude: null,
    confidence: null,
    status: parsed.data.closed ? 'RESOLVED' : 'ACTIVE',
    occurredAt,
    sourceUrl,
    metadata: {
      place,
      category: parsed.data.categories[0]?.title ?? category.type,
      sources: parsed.data.sources.map((source) => source.id).join(', ') || null,
    },
  };
}

function latestPoint(
  geometry: Array<{ date: string; type: string; coordinates: number[] }>,
): { latitude: number; longitude: number; date: string } | null {
  const points = geometry
    .filter((entry) => entry.type === 'Point' && entry.coordinates.length >= 2)
    .map((entry) => {
      const longitude = entry.coordinates[0];
      const latitude = entry.coordinates[1];
      if (longitude === undefined || latitude === undefined) {
        return null;
      }
      return { longitude, latitude, date: entry.date };
    })
    .filter(
      (entry): entry is { longitude: number; latitude: number; date: string } => entry !== null,
    )
    .sort((left, right) => Date.parse(left.date) - Date.parse(right.date));
  return points.at(-1) ?? null;
}

function placeFromTitle(title: string): string {
  const separator = title.indexOf(' - ');
  if (separator === -1) {
    return title;
  }
  const place = title.slice(separator + 3).trim();
  return place.length > 0 ? place : title;
}

function stormSeverity(title: string): Severity {
  return /(hurricane|typhoon|cyclone)/i.test(title) ? 'CRITICAL' : 'HIGH';
}

export class EonetProvider implements IncidentProvider {
  readonly name = 'eonet';
  readonly displayName = 'NASA EONET';

  constructor(
    private readonly url: string,
    private readonly timeoutMs: number,
  ) {}

  async fetchIncidents(): Promise<ProviderFetchResult> {
    const payload = await fetchJson(this.url, this.timeoutMs);
    return normalizeEonetFeed(payload);
  }
}
