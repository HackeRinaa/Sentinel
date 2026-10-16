import {
  incidentDetailSchema,
  incidentSchema,
  type HealthStatus,
  type Incident,
  type IncidentDetail,
  type IncidentStats,
  type NearbyIncident,
  type PaginationMeta,
  type SystemStatusPayload,
} from '@sentinel/shared';
import { buildIncidentSearch, type DashboardFilters } from '@/lib/filters';

export class ApiClientError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
  }
}

async function request(path: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(path, {
    signal,
    headers: { accept: 'application/json' },
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      body &&
      typeof body === 'object' &&
      'error' in body &&
      body.error &&
      typeof body.error === 'object' &&
      'message' in body.error &&
      typeof body.error.message === 'string'
        ? body.error.message
        : 'Request failed';
    throw new ApiClientError(message, response.status);
  }
  return body;
}

function readData(body: unknown): unknown {
  if (!body || typeof body !== 'object' || !('data' in body)) {
    throw new ApiClientError('Unexpected response from the API', 500);
  }
  return body.data;
}

function readMeta(body: unknown): PaginationMeta {
  if (
    !body ||
    typeof body !== 'object' ||
    !('meta' in body) ||
    !body.meta ||
    typeof body.meta !== 'object'
  ) {
    throw new ApiClientError('Unexpected pagination metadata', 500);
  }
  const meta = body.meta as Partial<PaginationMeta>;
  if (
    typeof meta.page !== 'number' ||
    typeof meta.pageSize !== 'number' ||
    typeof meta.total !== 'number' ||
    typeof meta.totalPages !== 'number'
  ) {
    throw new ApiClientError('Unexpected pagination metadata', 500);
  }
  return {
    page: meta.page,
    pageSize: meta.pageSize,
    total: meta.total,
    totalPages: meta.totalPages,
  };
}

export interface IncidentListResponse {
  data: Incident[];
  meta: PaginationMeta;
}

export async function fetchIncidents(
  filters: DashboardFilters,
  page: number,
  pageSize: number,
  signal?: AbortSignal,
): Promise<IncidentListResponse> {
  const body = await request(
    `/api/incidents?${buildIncidentSearch(filters, page, pageSize)}`,
    signal,
  );
  const parsed = incidentSchema.array().safeParse(readData(body));
  if (!parsed.success) {
    throw new ApiClientError('Incident list did not match the expected shape', 500);
  }
  return { data: parsed.data, meta: readMeta(body) };
}

export async function fetchIncident(id: string, signal?: AbortSignal): Promise<IncidentDetail> {
  const body = await request(`/api/incidents/${encodeURIComponent(id)}`, signal);
  const parsed = incidentDetailSchema.safeParse(readData(body));
  if (!parsed.success) {
    throw new ApiClientError('Incident did not match the expected shape', 500);
  }
  return parsed.data;
}

export async function fetchStats(
  filters: DashboardFilters,
  signal?: AbortSignal,
): Promise<IncidentStats> {
  const params = new URLSearchParams(buildIncidentSearch(filters, 1, 1));
  params.delete('page');
  params.delete('pageSize');
  params.delete('sortBy');
  params.delete('sortOrder');
  params.delete('status');
  const body = await request(`/api/incidents/stats?${params.toString()}`, signal);
  const data = readData(body);
  if (!data || typeof data !== 'object') {
    throw new ApiClientError('Stats response was empty', 500);
  }
  return data as IncidentStats;
}

export async function fetchNearby(
  latitude: number,
  longitude: number,
  radiusKm = 500,
  signal?: AbortSignal,
): Promise<NearbyIncident[]> {
  const params = new URLSearchParams({
    lat: String(latitude),
    lng: String(longitude),
    radiusKm: String(radiusKm),
  });
  const body = await request(`/api/incidents/nearby?${params.toString()}`, signal);
  const parsed = incidentSchema.array().safeParse(readData(body));
  if (!parsed.success) {
    throw new ApiClientError('Nearby incidents did not match the expected shape', 500);
  }
  return parsed.data as NearbyIncident[];
}

export async function fetchHealth(signal?: AbortSignal): Promise<HealthStatus> {
  const body = await request('/api/health', signal);
  return readData(body) as HealthStatus;
}

export async function fetchProviderStatus(signal?: AbortSignal): Promise<SystemStatusPayload> {
  const body = await request('/api/providers/status', signal);
  return readData(body) as SystemStatusPayload;
}
