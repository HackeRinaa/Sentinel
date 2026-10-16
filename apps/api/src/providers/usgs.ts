import {
  isValidCoordinate,
  sanitizeHttpUrl,
  severityFromMagnitude,
  type IncidentMetadata,
} from '@sentinel/shared';
import { z } from 'zod';
import { clampText } from '../utils/text.js';
import { fetchJson } from './http.js';
import type { IncidentProvider, NormalizedIncident, ProviderFetchResult } from './types.js';

const featureSchema = z.object({
  id: z.string().min(1),
  properties: z.object({
    mag: z.number().nullable(),
    place: z.string().nullable().optional(),
    time: z.number(),
    updated: z.number().optional(),
    url: z.string().optional(),
    title: z.string().min(1),
    status: z.string().optional(),
    tsunami: z.number().optional(),
    type: z.string(),
    magType: z.string().nullable().optional(),
  }),
  geometry: z
    .object({
      type: z.string(),
      coordinates: z.array(z.number()),
    })
    .nullable(),
});

const feedSchema = z.object({
  features: z.array(z.unknown()),
});

export function normalizeUsgsFeed(payload: unknown): ProviderFetchResult {
  const feed = feedSchema.safeParse(payload);
  if (!feed.success) {
    throw new Error('USGS response did not match the expected feed schema');
  }

  const incidents: NormalizedIncident[] = [];
  let skipped = 0;
  for (const feature of feed.data.features) {
    const normalized = normalizeUsgsFeature(feature);
    if (!normalized) {
      skipped += 1;
      continue;
    }
    incidents.push(normalized);
  }
  return { incidents, skipped };
}

export function normalizeUsgsFeature(feature: unknown): NormalizedIncident | null {
  const parsed = featureSchema.safeParse(feature);
  if (!parsed.success || !parsed.data.geometry) {
    return null;
  }
  if (parsed.data.properties.type.toLowerCase() !== 'earthquake') {
    return null;
  }
  const longitude = parsed.data.geometry.coordinates[0];
  const latitude = parsed.data.geometry.coordinates[1];
  const depth = parsed.data.geometry.coordinates[2];
  if (
    longitude === undefined ||
    latitude === undefined ||
    !isValidCoordinate(latitude, longitude)
  ) {
    return null;
  }

  const magnitude = parsed.data.properties.mag;
  const place = parsed.data.properties.place?.trim() || 'Unknown location';
  const metadata: IncidentMetadata = {
    place,
    depthKm: typeof depth === 'number' ? depth : null,
    magType: parsed.data.properties.magType ?? null,
    reviewStatus: parsed.data.properties.status ?? null,
    tsunami: parsed.data.properties.tsunami === 1,
    sourceUpdatedAt:
      typeof parsed.data.properties.updated === 'number'
        ? new Date(parsed.data.properties.updated).toISOString()
        : null,
  };

  const magnitudeLabel = magnitude === null ? 'Unmeasured' : `M ${magnitude.toFixed(1)}`;
  return {
    externalId: parsed.data.id,
    source: 'usgs',
    type: 'EARTHQUAKE',
    title: clampText(parsed.data.properties.title, 300),
    description: clampText(
      `${magnitudeLabel} earthquake near ${place}. Review status: ${parsed.data.properties.status ?? 'unknown'}. Depth ${typeof depth === 'number' ? `${depth.toFixed(1)} km` : 'unknown'}.`,
      4000,
    ),
    latitude,
    longitude,
    severity: severityFromMagnitude(magnitude),
    magnitude,
    confidence: null,
    status: 'ACTIVE',
    occurredAt: new Date(parsed.data.properties.time),
    sourceUrl: sanitizeHttpUrl(parsed.data.properties.url),
    metadata,
  };
}

export class UsgsEarthquakeProvider implements IncidentProvider {
  readonly name = 'usgs';
  readonly displayName = 'USGS Earthquake';

  constructor(
    private readonly url: string,
    private readonly timeoutMs: number,
  ) {}

  async fetchIncidents(): Promise<ProviderFetchResult> {
    const payload = await fetchJson(this.url, this.timeoutMs);
    return normalizeUsgsFeed(payload);
  }
}
