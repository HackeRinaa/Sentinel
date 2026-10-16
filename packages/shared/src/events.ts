import { z } from 'zod';
import { incidentSchema } from './incident.js';

export const providerStatusSchema = z.object({
  name: z.string(),
  displayName: z.string(),
  status: z.enum(['idle', 'operational', 'down']),
  lastSuccessAt: z.string().datetime().nullable(),
  lastAttemptAt: z.string().datetime().nullable(),
  lastError: z.string().nullable(),
  lastReceivedCount: z.number().int().nonnegative(),
  lastCreatedCount: z.number().int().nonnegative(),
  lastUpdatedCount: z.number().int().nonnegative(),
  lastRemovedCount: z.number().int().nonnegative(),
});

export type ProviderStatus = z.infer<typeof providerStatusSchema>;

export const systemStatusPayloadSchema = z.object({
  demoMode: z.boolean(),
  api: z.enum(['operational', 'degraded']),
  database: z.enum(['connected', 'disconnected']),
  lastSyncAt: z.string().datetime().nullable(),
  connectedClients: z.number().int().nonnegative(),
  providers: z.array(providerStatusSchema),
});

export type SystemStatusPayload = z.infer<typeof systemStatusPayloadSchema>;

const incidentPayload = z.object({ incident: incidentSchema });

export const realtimeEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('INCIDENT_CREATED'),
    timestamp: z.string().datetime(),
    payload: incidentPayload,
  }),
  z.object({
    type: z.literal('INCIDENT_UPDATED'),
    timestamp: z.string().datetime(),
    payload: incidentPayload,
  }),
  z.object({
    type: z.literal('INCIDENT_REMOVED'),
    timestamp: z.string().datetime(),
    payload: incidentPayload,
  }),
  z.object({
    type: z.literal('SYSTEM_STATUS'),
    timestamp: z.string().datetime(),
    payload: systemStatusPayloadSchema,
  }),
]);

export type RealtimeEvent = z.infer<typeof realtimeEventSchema>;

export interface HealthStatus {
  status: 'ok' | 'degraded';
  api: 'operational';
  database: 'connected' | 'disconnected';
  demoMode: boolean;
  uptimeSeconds: number;
  timestamp: string;
}

export interface IncidentStats {
  active: number;
  critical: number;
  last24h: number;
  byType: { type: z.infer<typeof incidentSchema>['type']; count: number }[];
  bySeverity: { severity: z.infer<typeof incidentSchema>['severity']; count: number }[];
  timeline: { bucket: string; count: number }[];
}

export interface NearbyIncident extends z.infer<typeof incidentSchema> {
  distanceKm: number;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details: unknown;
    requestId: string;
  };
}
