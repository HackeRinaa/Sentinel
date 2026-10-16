import { SEVERITY_LABELS, type Incident, type IncidentMetadata } from '@sentinel/shared';
import type { NormalizedIncident } from '../providers/types.js';

function numbersClose(left: number | null, right: number | null, epsilon: number): boolean {
  if (left === null || right === null) {
    return left === right;
  }
  return Math.abs(left - right) <= epsilon;
}

function metadataEqual(left: IncidentMetadata, right: IncidentMetadata): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  return leftKeys.every(
    (key) => Object.prototype.hasOwnProperty.call(right, key) && left[key] === right[key],
  );
}

export interface RevisionDraft {
  field: string;
  summary: string;
  previous: string | null;
  next: string | null;
}

export function describeChanges(existing: Incident, next: NormalizedIncident): RevisionDraft[] {
  const drafts: RevisionDraft[] = [];
  if (
    existing.magnitude !== null &&
    next.magnitude !== null &&
    !numbersClose(existing.magnitude, next.magnitude, 0.05)
  ) {
    drafts.push({
      field: 'magnitude',
      summary: `Magnitude revised from ${existing.magnitude.toFixed(1)} to ${next.magnitude.toFixed(1)}`,
      previous: existing.magnitude.toFixed(1),
      next: next.magnitude.toFixed(1),
    });
  }
  if (existing.severity !== next.severity) {
    drafts.push({
      field: 'severity',
      summary: `Severity changed from ${SEVERITY_LABELS[existing.severity]} to ${SEVERITY_LABELS[next.severity]}`,
      previous: SEVERITY_LABELS[existing.severity],
      next: SEVERITY_LABELS[next.severity],
    });
  }
  if (
    existing.confidence !== null &&
    next.confidence !== null &&
    !numbersClose(existing.confidence, next.confidence, 0.01)
  ) {
    drafts.push({
      field: 'confidence',
      summary: `Confidence changed from ${percent(existing.confidence)} to ${percent(next.confidence)}`,
      previous: percent(existing.confidence),
      next: percent(next.confidence),
    });
  }
  const previousContainment = numericMetadata(existing.metadata, 'containmentPct');
  const nextContainment = numericMetadata(next.metadata, 'containmentPct');
  if (
    previousContainment !== null &&
    nextContainment !== null &&
    previousContainment !== nextContainment
  ) {
    drafts.push({
      field: 'containment',
      summary: `Containment changed from ${previousContainment}% to ${nextContainment}%`,
      previous: String(previousContainment),
      next: String(nextContainment),
    });
  }
  if (existing.status !== next.status) {
    drafts.push({
      field: 'status',
      summary: `Status changed from ${existing.status} to ${next.status}`,
      previous: existing.status,
      next: next.status,
    });
  }
  if (drafts.length === 0) {
    drafts.push({
      field: 'record',
      summary: 'Source record updated',
      previous: null,
      next: null,
    });
  }
  return drafts.slice(0, 4);
}

export const resolvedRevision = {
  field: 'status',
  summary: 'Marked resolved after it left the source snapshot',
  previous: 'Active',
  next: 'Resolved',
} as const;

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function numericMetadata(metadata: IncidentMetadata, key: string): number | null {
  const value = metadata[key];
  return typeof value === 'number' ? value : null;
}

export function hasMaterialChange(existing: Incident, next: NormalizedIncident): boolean {
  return !(
    existing.type === next.type &&
    existing.title === next.title &&
    existing.description === next.description &&
    existing.severity === next.severity &&
    existing.status === next.status &&
    existing.sourceUrl === next.sourceUrl &&
    numbersClose(existing.latitude, next.latitude, 0.0001) &&
    numbersClose(existing.longitude, next.longitude, 0.0001) &&
    numbersClose(existing.magnitude, next.magnitude, 0.05) &&
    numbersClose(existing.confidence, next.confidence, 0.01) &&
    Math.abs(Date.parse(existing.occurredAt) - next.occurredAt.getTime()) < 1000 &&
    metadataEqual(existing.metadata, next.metadata)
  );
}

export function dedupeIncidents(incidents: NormalizedIncident[]): NormalizedIncident[] {
  const byKey = new Map<string, NormalizedIncident>();
  for (const incident of incidents) {
    const key = `${incident.source}:${incident.externalId}`;
    const existing = byKey.get(key);
    if (!existing || incident.occurredAt.getTime() >= existing.occurredAt.getTime()) {
      byKey.set(key, incident);
    }
  }
  return [...byKey.values()];
}

export function toDomainIncident(
  id: string,
  incident: NormalizedIncident,
  timestamps: { createdAt: Date; updatedAt: Date; resolvedAt: Date | null },
): Incident {
  return {
    id,
    externalId: incident.externalId,
    source: incident.source,
    type: incident.type,
    title: incident.title,
    description: incident.description,
    latitude: incident.latitude,
    longitude: incident.longitude,
    severity: incident.severity,
    magnitude: incident.magnitude,
    confidence: incident.confidence,
    status: incident.status,
    occurredAt: incident.occurredAt.toISOString(),
    updatedAt: timestamps.updatedAt.toISOString(),
    createdAt: timestamps.createdAt.toISOString(),
    resolvedAt: timestamps.resolvedAt ? timestamps.resolvedAt.toISOString() : null,
    sourceUrl: incident.sourceUrl,
    metadata: incident.metadata,
  };
}
