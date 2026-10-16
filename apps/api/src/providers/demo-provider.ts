import { severityFromMagnitude } from '@sentinel/shared';
import { DEMO_TEMPLATES, EMERGING_TEMPLATES, type DemoTemplate } from './demo-catalog.js';
import type { IncidentProvider, NormalizedIncident, ProviderFetchResult } from './types.js';

export interface DemoState {
  active: NormalizedIncident[];
  sequence: number;
  emergingIndex: number;
  beat: number;
}

const OPENING_BEATS = 3;

export function templateToIncident(template: DemoTemplate, now: Date): NormalizedIncident {
  return {
    externalId: template.externalId,
    source: 'demo',
    type: template.type,
    title: template.title,
    description: template.description,
    latitude: template.latitude,
    longitude: template.longitude,
    severity: template.severity,
    magnitude: template.magnitude,
    confidence: template.confidence,
    status: 'ACTIVE',
    occurredAt: new Date(now.getTime() - template.minutesAgo * 60_000),
    sourceUrl: template.sourceUrl,
    metadata: {
      place: template.place,
      simulated: true,
      ...(template.metadata ?? {}),
    },
  };
}

export function createInitialDemoState(now: Date): DemoState {
  return {
    active: DEMO_TEMPLATES.map((template) => templateToIncident(template, now)),
    sequence: 1,
    emergingIndex: 0,
    beat: 0,
  };
}

export function advanceDemoState(state: DemoState, now: Date, random: () => number): DemoState {
  if (state.beat < OPENING_BEATS) {
    return applyOpeningBeat(state, now);
  }
  const active = state.active.map((incident) => ({
    ...incident,
    metadata: { ...incident.metadata },
  }));
  let sequence = state.sequence;
  let emergingIndex = state.emergingIndex;

  if (active.length > 0) {
    const index = Math.min(active.length - 1, Math.floor(random() * active.length));
    const current = active[index];
    if (current) {
      active[index] = reviseIncident(current, now);
    }
  }

  const emerging = EMERGING_TEMPLATES[emergingIndex];
  if (emerging && random() < 0.7) {
    active.unshift(templateToIncident(emerging, now));
    emergingIndex += 1;
  } else if (!emerging && random() < 0.3) {
    const parent =
      active.find(
        (incident) => incident.type === 'EARTHQUAKE' && (incident.magnitude ?? 0) >= 4.5,
      ) ?? active[0];
    if (parent) {
      active.unshift(createAftershock(parent, sequence, now, random));
      sequence += 1;
    }
  }

  let next = active;
  if (next.length > 12 && random() < 0.55) {
    const removable = [...next]
      .reverse()
      .find((incident) => incident.severity === 'LOW' || incident.severity === 'MODERATE');
    if (removable) {
      next = next.filter((incident) => incident.externalId !== removable.externalId);
    }
  }

  return { active: next, sequence, emergingIndex, beat: state.beat };
}

function applyOpeningBeat(state: DemoState, now: Date): DemoState {
  const active = state.active.map((incident) => ({
    ...incident,
    metadata: { ...incident.metadata },
  }));
  let sequence = state.sequence;

  if (state.beat === 0) {
    replaceIncident(active, 'demo-eq-ridgecrest', (incident) =>
      reviseMagnitude(incident, 5.7, now),
    );
  } else if (state.beat === 1) {
    const parent = active.find((incident) => incident.externalId === 'demo-eq-ridgecrest');
    if (parent) {
      active.unshift(createAftershock(parent, sequence, now, () => 0.35));
      sequence += 1;
    }
  } else {
    replaceIncident(active, 'demo-fire-angeles', (incident) => upgradeAngelesFire(incident, now));
  }

  return { active, sequence, emergingIndex: state.emergingIndex, beat: state.beat + 1 };
}

function replaceIncident(
  active: NormalizedIncident[],
  externalId: string,
  revise: (incident: NormalizedIncident) => NormalizedIncident,
): void {
  const index = active.findIndex((incident) => incident.externalId === externalId);
  const current = active[index];
  if (current) {
    active[index] = revise(current);
  }
}

function reviseMagnitude(
  incident: NormalizedIncident,
  magnitude: number,
  now: Date,
): NormalizedIncident {
  return {
    ...incident,
    magnitude,
    severity: severityFromMagnitude(magnitude),
    title: incident.title.replace(/^M [\d.]+/, `M ${magnitude.toFixed(1)}`),
    description: `${baseDescription(incident)}\nRevised magnitude ${magnitude.toFixed(1)} at ${now.toISOString()}.`,
    metadata: { ...incident.metadata, revisedAt: now.toISOString() },
  };
}

function upgradeAngelesFire(incident: NormalizedIncident, now: Date): NormalizedIncident {
  return {
    ...incident,
    severity: 'CRITICAL',
    confidence: 0.93,
    description: `${baseDescription(incident)}\nExercise upgrade: spread accelerated and the fire is now critical as of ${now.toISOString()}.`,
    metadata: {
      ...incident.metadata,
      acres: 6400,
      containmentPct: 4,
      revisedAt: now.toISOString(),
    },
  };
}

function baseDescription(incident: NormalizedIncident): string {
  return incident.description.split('\n')[0] ?? incident.description;
}

function reviseIncident(incident: NormalizedIncident, now: Date): NormalizedIncident {
  const revisedAt = now.toISOString();
  if (incident.type === 'EARTHQUAKE' && incident.magnitude !== null) {
    const magnitude = Math.round((incident.magnitude + 0.1) * 10) / 10;
    return {
      ...incident,
      magnitude,
      severity: severityFromMagnitude(magnitude),
      title: incident.title.replace(/^M [\d.]+/, `M ${magnitude.toFixed(1)}`),
      description: `${baseDescription(incident)}\nRevised magnitude ${magnitude.toFixed(1)} at ${revisedAt}.`,
      metadata: { ...incident.metadata, revisedAt },
    };
  }
  if (incident.type === 'WILDFIRE') {
    const current =
      typeof incident.metadata.containmentPct === 'number' ? incident.metadata.containmentPct : 10;
    const containmentPct = Math.min(100, current + 8);
    const confidence = Math.min(
      0.98,
      Math.round(((incident.confidence ?? 0.5) + 0.04) * 100) / 100,
    );
    return {
      ...incident,
      confidence,
      description: `${baseDescription(incident)}\nContainment updated to ${containmentPct}% at ${revisedAt}.`,
      metadata: { ...incident.metadata, containmentPct, revisedAt },
    };
  }
  return {
    ...incident,
    description: `${baseDescription(incident)}\nSituation update recorded at ${revisedAt}.`,
    metadata: { ...incident.metadata, revisedAt },
  };
}

function createAftershock(
  parent: NormalizedIncident,
  sequence: number,
  now: Date,
  random: () => number,
): NormalizedIncident {
  const magnitude = Math.max(
    2.5,
    Math.round(((parent.magnitude ?? 4.5) - 1.3 - random() * 0.4) * 10) / 10,
  );
  const place =
    typeof parent.metadata.place === 'string' ? parent.metadata.place : 'the epicentral area';
  return {
    externalId: `demo-aftershock-${sequence}`,
    source: 'demo',
    type: 'EARTHQUAKE',
    title: `M ${magnitude.toFixed(1)} - aftershock near ${place}`,
    description: `Simulated scenario. Aftershock recorded near ${place}. This exercise event is not an official seismic alert.`,
    latitude: clamp(parent.latitude + (random() - 0.5) * 0.3, -90, 90),
    longitude: clamp(parent.longitude + (random() - 0.5) * 0.3, -180, 180),
    severity: severityFromMagnitude(magnitude),
    magnitude,
    confidence: null,
    status: 'ACTIVE',
    occurredAt: now,
    sourceUrl: 'https://earthquake.usgs.gov/earthquakes/map/',
    metadata: {
      place,
      depthKm: 8 + Math.round(random() * 10),
      parentExternalId: parent.externalId,
      simulated: true,
    },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function createDemoProvider(options?: {
  now?: () => Date;
  random?: () => number;
}): IncidentProvider {
  const now = options?.now ?? (() => new Date());
  const random = options?.random ?? Math.random;
  let state = createInitialDemoState(now());
  let started = false;

  return {
    name: 'demo',
    displayName: 'Demo simulator',
    async fetchIncidents(): Promise<ProviderFetchResult> {
      if (started) {
        state = advanceDemoState(state, now(), random);
      }
      started = true;
      return {
        incidents: state.active.map((incident) => structuredClone(incident)),
        skipped: 0,
      };
    },
  };
}
