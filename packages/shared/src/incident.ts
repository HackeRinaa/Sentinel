import { z } from 'zod';

export const INCIDENT_TYPES = ['EARTHQUAKE', 'WILDFIRE', 'STORM', 'FLOOD', 'OTHER'] as const;
export const SEVERITIES = ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'] as const;
export const INCIDENT_STATUSES = ['ACTIVE', 'RESOLVED'] as const;

export const incidentTypeSchema = z.enum(INCIDENT_TYPES);
export const severitySchema = z.enum(SEVERITIES);
export const incidentStatusSchema = z.enum(INCIDENT_STATUSES);

export type IncidentType = z.infer<typeof incidentTypeSchema>;
export type Severity = z.infer<typeof severitySchema>;
export type IncidentStatus = z.infer<typeof incidentStatusSchema>;

export const incidentMetadataSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.null()]),
);

export type IncidentMetadata = z.infer<typeof incidentMetadataSchema>;

export const incidentSchema = z.object({
  id: z.string().min(1),
  externalId: z.string().min(1),
  source: z.string().min(1),
  type: incidentTypeSchema,
  title: z.string().min(1),
  description: z.string(),
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180),
  severity: severitySchema,
  magnitude: z.number().nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  status: incidentStatusSchema,
  occurredAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  resolvedAt: z.string().datetime().nullable(),
  sourceUrl: z.string().url().nullable(),
  metadata: incidentMetadataSchema,
});

export type Incident = z.infer<typeof incidentSchema>;

export const incidentRevisionSchema = z.object({
  id: z.string().min(1),
  recordedAt: z.string().datetime(),
  summary: z.string(),
  field: z.string().min(1),
  previous: z.string().nullable(),
  next: z.string().nullable(),
});

export type IncidentRevision = z.infer<typeof incidentRevisionSchema>;

export const incidentDetailSchema = incidentSchema.extend({
  revisions: z.array(incidentRevisionSchema),
});

export type IncidentDetail = z.infer<typeof incidentDetailSchema>;

export const SEVERITY_RANK: Record<Severity, number> = {
  LOW: 1,
  MODERATE: 2,
  HIGH: 3,
  CRITICAL: 4,
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  LOW: 'Low',
  MODERATE: 'Moderate',
  HIGH: 'High',
  CRITICAL: 'Critical',
};

export const TYPE_LABELS: Record<IncidentType, string> = {
  EARTHQUAKE: 'Earthquake',
  WILDFIRE: 'Wildfire',
  STORM: 'Storm',
  FLOOD: 'Flood',
  OTHER: 'Other',
};

export const SEVERITY_COLORS: Record<Severity, string> = {
  LOW: '#1f9d6a',
  MODERATE: '#c89214',
  HIGH: '#e06a1a',
  CRITICAL: '#e11d48',
};

export const TYPE_COLORS: Record<IncidentType, string> = {
  EARTHQUAKE: '#38bdf8',
  WILDFIRE: '#f97316',
  STORM: '#a78bfa',
  FLOOD: '#22d3ee',
  OTHER: '#94a3b8',
};

export const KNOWN_SOURCES = [
  { id: 'usgs', label: 'USGS' },
  { id: 'eonet', label: 'NASA EONET' },
  { id: 'demo', label: 'Demo simulator' },
] as const;

export function sourceLabel(source: string): string {
  return KNOWN_SOURCES.find((entry) => entry.id === source)?.label ?? source;
}

export function severityFromMagnitude(magnitude: number | null): Severity {
  if (magnitude === null || Number.isNaN(magnitude)) {
    return 'LOW';
  }
  if (magnitude >= 6) {
    return 'CRITICAL';
  }
  if (magnitude >= 4.5) {
    return 'HIGH';
  }
  if (magnitude >= 2.5) {
    return 'MODERATE';
  }
  return 'LOW';
}

export function meetsMinSeverity(severity: Severity, minimum: Severity): boolean {
  return SEVERITY_RANK[severity] >= SEVERITY_RANK[minimum];
}

export function parseMetadata(value: unknown): IncidentMetadata {
  const parsed = incidentMetadataSchema.safeParse(value);
  return parsed.success ? parsed.data : {};
}

export function sanitizeHttpUrl(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function incidentPlace(
  incident: Pick<Incident, 'metadata' | 'latitude' | 'longitude'>,
): string {
  const place = incident.metadata.place;
  if (typeof place === 'string' && place.trim().length > 0) {
    return place;
  }
  return `${incident.latitude.toFixed(2)}, ${incident.longitude.toFixed(2)}`;
}

export function isValidCoordinate(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}
