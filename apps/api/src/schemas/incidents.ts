import {
  INCIDENT_TYPES,
  incidentStatusSchema,
  SEVERITIES,
  severitySchema,
  type IncidentStatus,
  type IncidentType,
  type Severity,
} from '@sentinel/shared';
import { z } from 'zod';
import type { IncidentListQuery } from '../repositories/types.js';

const issue = (message: string) => ({
  code: z.ZodIssueCode.custom,
  message,
});

function csvEnum<const T extends readonly [string, ...string[]]>(values: T) {
  const allowed = new Set<string>(values);
  return z
    .string()
    .optional()
    .transform((value, context) => {
      if (!value || value.trim() === '') {
        return [] as Array<T[number]>;
      }
      const parts = value
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
      for (const part of parts) {
        if (!allowed.has(part)) {
          context.addIssue(issue(`Invalid value "${part}"`));
          return z.NEVER;
        }
      }
      return parts as Array<T[number]>;
    });
}

function dateBound(boundary: 'start' | 'end') {
  return z
    .string()
    .optional()
    .transform((value, context) => {
      if (!value || value.trim() === '') {
        return null;
      }
      const trimmed = value.trim();
      const iso = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
        ? `${trimmed}${boundary === 'start' ? 'T00:00:00.000Z' : 'T23:59:59.999Z'}`
        : trimmed;
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) {
        context.addIssue(issue('Invalid date'));
        return z.NEVER;
      }
      return date;
    });
}

const optionalNumber = (min: number, max: number) =>
  z.preprocess(
    (value) => (value === '' || value === undefined ? undefined : value),
    z.coerce.number().gte(min).lte(max).optional(),
  );

const filterShape = {
  type: csvEnum(INCIDENT_TYPES),
  severity: csvEnum(SEVERITIES),
  source: z
    .string()
    .optional()
    .transform((value) => {
      if (!value || value.trim() === '') {
        return [] as string[];
      }
      return value
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
    }),
  startDate: dateBound('start'),
  endDate: dateBound('end'),
  minSeverity: z.preprocess(
    (value) => (value === '' || value === undefined ? undefined : value),
    severitySchema.optional(),
  ),
  minLat: optionalNumber(-90, 90),
  maxLat: optionalNumber(-90, 90),
  minLng: optionalNumber(-180, 180),
  maxLng: optionalNumber(-180, 180),
  search: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
};

function refineBounds(
  value: {
    minLat?: number;
    maxLat?: number;
    minLng?: number;
    maxLng?: number;
    startDate: Date | null;
    endDate: Date | null;
  },
  context: z.RefinementCtx,
): void {
  const coordinates = [value.minLat, value.maxLat, value.minLng, value.maxLng];
  const present = coordinates.filter((item) => item !== undefined);
  if (present.length > 0 && present.length < 4) {
    context.addIssue({
      ...issue('Bounding box requires minLat, maxLat, minLng, and maxLng'),
      path: ['bbox'],
    });
  }
  if (
    value.minLat !== undefined &&
    value.maxLat !== undefined &&
    value.minLng !== undefined &&
    value.maxLng !== undefined &&
    (value.minLat > value.maxLat || value.minLng > value.maxLng)
  ) {
    context.addIssue({
      ...issue('Bounding box minimums must be less than or equal to maximums'),
      path: ['bbox'],
    });
  }
  if (value.startDate && value.endDate && value.startDate > value.endDate) {
    context.addIssue({ ...issue('startDate must be before endDate'), path: ['startDate'] });
  }
}

function toBbox(value: {
  minLat?: number;
  maxLat?: number;
  minLng?: number;
  maxLng?: number;
}): IncidentListQuery['bbox'] {
  if (
    value.minLat === undefined ||
    value.maxLat === undefined ||
    value.minLng === undefined ||
    value.maxLng === undefined
  ) {
    return null;
  }
  return {
    minLat: value.minLat,
    maxLat: value.maxLat,
    minLng: value.minLng,
    maxLng: value.maxLng,
  };
}

export const incidentListQuerySchema = z
  .object({
    ...filterShape,
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(500).default(50),
    sortBy: z.enum(['occurredAt', 'updatedAt', 'severity', 'magnitude']).default('occurredAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    status: z.preprocess(
      (value) => (value === '' || value === undefined ? undefined : value),
      incidentStatusSchema.default('ACTIVE'),
    ),
  })
  .superRefine(refineBounds)
  .transform((value) => ({
    types: value.type as IncidentType[],
    severities: value.severity as Severity[],
    sources: value.source,
    startDate: value.startDate,
    endDate: value.endDate,
    minSeverity: value.minSeverity ?? null,
    bbox: toBbox(value),
    search: value.search ?? null,
    page: value.page,
    pageSize: value.pageSize,
    sortBy: value.sortBy,
    sortOrder: value.sortOrder,
    status: value.status as IncidentStatus,
  }));

export const incidentStatsQuerySchema = z
  .object(filterShape)
  .superRefine(refineBounds)
  .transform((value) => ({
    types: value.type as IncidentType[],
    severities: value.severity as Severity[],
    sources: value.source,
    startDate: value.startDate,
    endDate: value.endDate,
    minSeverity: value.minSeverity ?? null,
    bbox: toBbox(value),
    search: value.search ?? null,
  }));

export const nearbyQuerySchema = z
  .object({
    lat: z.coerce.number().gte(-90).lte(90),
    lng: z.coerce.number().gte(-180).lte(180),
    radiusKm: z.coerce.number().gt(0).max(20_000).default(500),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .transform((value) => ({
    latitude: value.lat,
    longitude: value.lng,
    radiusKm: value.radiusKm,
    limit: value.limit,
  }));

export const incidentIdSchema = z.object({
  id: z.string().min(1).max(200),
});
