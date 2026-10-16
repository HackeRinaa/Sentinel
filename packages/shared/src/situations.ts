import { haversineKm } from './geo.js';
import {
  SEVERITY_LABELS,
  SEVERITY_RANK,
  TYPE_LABELS,
  type Incident,
  type IncidentType,
  type Severity,
} from './incident.js';

export const SITUATION_RADIUS_KM = 200;
export const SITUATION_LIMIT = 6;

export interface Situation {
  id: string;
  primaryId: string;
  secondaryId: string;
  distanceKm: number;
  severity: Severity;
  summary: string;
}

type SituationIncident = Pick<
  Incident,
  | 'id'
  | 'type'
  | 'title'
  | 'severity'
  | 'status'
  | 'occurredAt'
  | 'magnitude'
  | 'latitude'
  | 'longitude'
>;

export function findSituations(incidents: SituationIncident[]): Situation[] {
  const active = incidents.filter((incident) => incident.status === 'ACTIVE');
  const situations: Situation[] = [];

  for (let leftIndex = 0; leftIndex < active.length; leftIndex += 1) {
    const left = active[leftIndex];
    if (!left) {
      continue;
    }
    for (let rightIndex = leftIndex + 1; rightIndex < active.length; rightIndex += 1) {
      const right = active[rightIndex];
      if (!right || left.type === right.type) {
        continue;
      }
      if (
        SEVERITY_RANK[left.severity] < SEVERITY_RANK.HIGH &&
        SEVERITY_RANK[right.severity] < SEVERITY_RANK.HIGH
      ) {
        continue;
      }
      const distanceKm = haversineKm(left, right);
      if (distanceKm > SITUATION_RADIUS_KM) {
        continue;
      }
      const [primary, secondary] =
        SEVERITY_RANK[left.severity] > SEVERITY_RANK[right.severity] ||
        (SEVERITY_RANK[left.severity] === SEVERITY_RANK[right.severity] && left.id < right.id)
          ? [left, right]
          : [right, left];
      const rounded = Math.round(distanceKm);
      situations.push({
        id: [left.id, right.id].sort().join(':'),
        primaryId: primary.id,
        secondaryId: secondary.id,
        distanceKm: rounded,
        severity: primary.severity,
        summary: situationSummary(primary, secondary, rounded),
      });
    }
  }

  return situations
    .sort((left, right) => {
      const severityDelta = SEVERITY_RANK[right.severity] - SEVERITY_RANK[left.severity];
      if (severityDelta !== 0) {
        return severityDelta;
      }
      return left.distanceKm - right.distanceKm;
    })
    .slice(0, SITUATION_LIMIT);
}

export function buildSituationBrief(
  incidents: SituationIncident[],
  situations: Situation[],
  now: Date,
): string {
  const active = incidents.filter((incident) => incident.status === 'ACTIVE');
  if (active.length === 0) {
    return 'No active incidents in the current view.';
  }
  const critical = active.filter((incident) => incident.severity === 'CRITICAL').length;
  const newest = [...active].sort(
    (left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt),
  )[0];
  const sentences = [critical === 0 ? 'No critical incidents.' : `${critical} critical.`];
  if (newest) {
    sentences.push(`Newest: ${newest.title}, ${relativeTime(newest.occurredAt, now)}.`);
  }
  const lead = situations[0];
  if (lead) {
    sentences.push(`Compound situation: ${lead.summary}.`);
    if (situations.length > 1) {
      sentences.push(`${situations.length} compound situations are in view.`);
    }
  }
  return sentences.join(' ');
}

function situationSummary(
  primary: SituationIncident,
  secondary: SituationIncident,
  distanceKm: number,
): string {
  const other = hazardLabel(secondary);
  const article = other.startsWith('M ') || /^[aeiou]/i.test(other) ? 'an' : 'a';
  return `${SEVERITY_LABELS[primary.severity]} ${TYPE_LABELS[primary.type].toLowerCase()} ${distanceKm} km from ${article} ${other}`;
}

function hazardLabel(incident: SituationIncident): string {
  if (incident.type === 'EARTHQUAKE' && incident.magnitude !== null) {
    return `M ${incident.magnitude.toFixed(1)}`;
  }
  return TYPE_LABELS[incident.type as IncidentType].toLowerCase();
}

function relativeTime(iso: string, now: Date): string {
  const elapsed = now.getTime() - Date.parse(iso);
  if (!Number.isFinite(elapsed) || elapsed < 45_000) {
    return 'just now';
  }
  const minutes = Math.round(elapsed / 60_000);
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 36) {
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}
