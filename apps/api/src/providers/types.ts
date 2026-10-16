import type { IncidentMetadata, IncidentStatus, IncidentType, Severity } from '@sentinel/shared';

export interface NormalizedIncident {
  externalId: string;
  source: string;
  type: IncidentType;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  severity: Severity;
  magnitude: number | null;
  confidence: number | null;
  status: IncidentStatus;
  occurredAt: Date;
  sourceUrl: string | null;
  metadata: IncidentMetadata;
}

export interface ProviderFetchResult {
  incidents: NormalizedIncident[];
  skipped: number;
}

export interface IncidentProvider {
  readonly name: string;
  readonly displayName: string;
  fetchIncidents(): Promise<ProviderFetchResult>;
}
