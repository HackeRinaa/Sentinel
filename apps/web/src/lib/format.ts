import {
  incidentPlace,
  sanitizeHttpUrl,
  SEVERITY_LABELS,
  TYPE_LABELS,
  type Incident,
  type Severity,
} from '@sentinel/shared';
import { formatDistanceToNow } from 'date-fns';

export function formatRelativeTime(iso: string, now: Date): string {
  const date = new Date(iso);
  const delta = now.getTime() - date.getTime();
  if (Number.isNaN(date.getTime())) {
    return 'Unknown time';
  }
  if (delta >= 0 && delta < 10_000) {
    return 'just now';
  }
  return formatDistanceToNow(date, { addSuffix: true });
}

export function formatTimestamp(iso: string): { local: string; utc: string } {
  const date = new Date(iso);
  return {
    local: new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
      date,
    ),
    utc: `${new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'UTC',
    }).format(date)} UTC`,
  };
}

export function formatCoordinates(latitude: number, longitude: number): string {
  const latitudeLabel = latitude >= 0 ? 'N' : 'S';
  const longitudeLabel = longitude >= 0 ? 'E' : 'W';
  return `${Math.abs(latitude).toFixed(4)}° ${latitudeLabel}, ${Math.abs(longitude).toFixed(4)}° ${longitudeLabel}`;
}

export function formatConfidence(confidence: number | null): string | null {
  if (confidence === null) {
    return null;
  }
  if (confidence >= 0.75) {
    return 'High confidence';
  }
  if (confidence >= 0.45) {
    return 'Moderate confidence';
  }
  return 'Low confidence';
}

export function formatMetric(incident: Incident): string {
  if (incident.type === 'EARTHQUAKE' && incident.magnitude !== null) {
    return `M ${incident.magnitude.toFixed(1)}`;
  }
  const confidence = formatConfidence(incident.confidence);
  if (confidence) {
    return confidence;
  }
  if (typeof incident.metadata.acres === 'number') {
    return `${incident.metadata.acres.toLocaleString()} acres`;
  }
  return SEVERITY_LABELS[incident.severity];
}

export function formatFeedTitle(incident: Incident): string {
  return `${TYPE_LABELS[incident.type]} — ${formatMetric(incident)}`;
}

export function formatPlace(incident: Incident): string {
  return incidentPlace(incident);
}

export function externalUrl(value: string | null): string | null {
  return sanitizeHttpUrl(value);
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function severityTextClass(severity: Severity): string {
  switch (severity) {
    case 'LOW':
      return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
    case 'MODERATE':
      return 'bg-amber-400/20 text-amber-800 dark:text-amber-200';
    case 'HIGH':
      return 'bg-orange-500/15 text-orange-800 dark:text-orange-200';
    case 'CRITICAL':
      return 'bg-rose-500/15 text-rose-700 dark:text-rose-200';
  }
}
