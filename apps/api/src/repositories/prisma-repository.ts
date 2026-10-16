import {
  boundingBoxForRadius,
  haversineKm,
  parseMetadata,
  type Incident,
  type IncidentDetail,
  type IncidentRevision,
  type NearbyIncident,
} from '@sentinel/shared';
import { Prisma, PrismaClient } from '@prisma/client';
import type { NormalizedIncident } from '../providers/types.js';
import { toDomainIncident, type RevisionDraft } from './change-detection.js';
import { summarizeIncidents } from './summary.js';
import { applySnapshot, type IncidentStore } from './sync.js';
import type {
  IncidentListQuery,
  IncidentRepository,
  IncidentStatsQuery,
  NearbyQuery,
  PaginatedIncidents,
  SyncResult,
} from './types.js';
import { buildIncidentWhere } from './where.js';

export class PrismaIncidentRepository implements IncidentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async applySnapshot(
    source: string,
    incidents: NormalizedIncident[],
    options: { allowRemovals: boolean },
  ): Promise<SyncResult> {
    return applySnapshot(this.createStore(), source, incidents, options);
  }

  async list(query: IncidentListQuery): Promise<PaginatedIncidents> {
    const where = buildIncidentWhere(query);
    const skip = (query.page - 1) * query.pageSize;
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.incident.count({ where }),
      this.prisma.incident.findMany({
        where,
        orderBy: orderBy(query),
        skip,
        take: query.pageSize,
      }),
    ]);
    return {
      items: rows.map(toIncident),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
      },
    };
  }

  async findById(id: string): Promise<IncidentDetail | null> {
    const row = await this.prisma.incident.findUnique({
      where: { id },
      include: { revisions: { orderBy: { recordedAt: 'desc' }, take: 12 } },
    });
    if (!row) {
      return null;
    }
    return { ...toIncident(row), revisions: row.revisions.map(toRevision) };
  }

  async stats(query: IncidentStatsQuery) {
    const rows = await this.prisma.incident.findMany({
      where: buildIncidentWhere({ ...query, status: 'ANY' }),
      select: { type: true, severity: true, status: true, occurredAt: true },
    });
    return summarizeIncidents(rows, query, new Date());
  }

  async nearby(query: NearbyQuery): Promise<NearbyIncident[]> {
    const bbox = boundingBoxForRadius(query.latitude, query.longitude, query.radiusKm);
    const rows = await this.prisma.incident.findMany({
      where: {
        status: 'ACTIVE',
        latitude: { gte: bbox.minLat, lte: bbox.maxLat },
        longitude: { gte: bbox.minLng, lte: bbox.maxLng },
      },
      take: 1000,
    });
    return rows
      .map((row) => {
        const incident = toIncident(row);
        const distanceKm = haversineKm(
          { latitude: query.latitude, longitude: query.longitude },
          { latitude: incident.latitude, longitude: incident.longitude },
        );
        return { incident, distanceKm };
      })
      .filter((entry) => entry.distanceKm <= query.radiusKm)
      .sort((left, right) => left.distanceKm - right.distanceKm)
      .slice(0, query.limit)
      .map((entry) => ({
        ...entry.incident,
        distanceKm: Math.round(entry.distanceKm * 10) / 10,
      }));
  }

  async countActiveBySource(source: string): Promise<number> {
    return this.prisma.incident.count({ where: { source, status: 'ACTIVE' } });
  }

  private async persistRevisions(
    incidentId: string,
    drafts: RevisionDraft[],
    now: Date,
  ): Promise<void> {
    if (drafts.length === 0) {
      return;
    }
    await this.prisma.incidentRevision.createMany({
      data: drafts.map((draft) => ({
        incidentId,
        recordedAt: now,
        summary: draft.summary,
        field: draft.field,
        previous: draft.previous,
        next: draft.next,
      })),
    });
    const rows = await this.prisma.incidentRevision.findMany({
      where: { incidentId },
      orderBy: { recordedAt: 'desc' },
      select: { id: true },
    });
    const extra = rows.slice(12).map((row) => row.id);
    if (extra.length > 0) {
      await this.prisma.incidentRevision.deleteMany({ where: { id: { in: extra } } });
    }
  }

  private createStore(): IncidentStore {
    return {
      listBySource: async (source) => {
        const rows = await this.prisma.incident.findMany({ where: { source } });
        return rows.map(toIncident);
      },
      insert: async (incident, now) => {
        const row = await this.prisma.incident.create({ data: toCreateData(incident, now) });
        return toIncident(row);
      },
      update: async (id, incident, now) => {
        const row = await this.prisma.incident.update({
          where: { id },
          data: {
            ...toMutableData(incident),
            updatedAt: now,
            lastSeenAt: now,
            resolvedAt: incident.status === 'RESOLVED' ? now : null,
          },
        });
        return toIncident(row);
      },
      touch: async (id, now) => {
        await this.prisma.incident.update({
          where: { id },
          data: { lastSeenAt: now },
        });
      },
      recordRevisions: async (incidentId, drafts, now) => {
        await this.persistRevisions(incidentId, drafts, now);
      },
      markResolved: async (id, now) => {
        const row = await this.prisma.incident.update({
          where: { id },
          data: { status: 'RESOLVED', resolvedAt: now, updatedAt: now, lastSeenAt: now },
        });
        return toIncident(row);
      },
    };
  }
}

export function toCreateData(incident: NormalizedIncident, now: Date): Prisma.IncidentCreateInput {
  return {
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
    occurredAt: incident.occurredAt,
    sourceUrl: incident.sourceUrl,
    metadata: incident.metadata as Prisma.InputJsonValue,
    lastSeenAt: now,
    createdAt: now,
    updatedAt: now,
    resolvedAt: incident.status === 'RESOLVED' ? now : null,
  };
}

function toMutableData(incident: NormalizedIncident): Prisma.IncidentUpdateInput {
  return {
    type: incident.type,
    title: incident.title,
    description: incident.description,
    latitude: incident.latitude,
    longitude: incident.longitude,
    severity: incident.severity,
    magnitude: incident.magnitude,
    confidence: incident.confidence,
    status: incident.status,
    sourceUrl: incident.sourceUrl,
    metadata: incident.metadata as Prisma.InputJsonValue,
    occurredAt: incident.occurredAt,
  };
}

function toIncident(row: {
  id: string;
  externalId: string;
  source: string;
  type: Incident['type'];
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  severity: Incident['severity'];
  magnitude: number | null;
  confidence: number | null;
  status: Incident['status'];
  occurredAt: Date;
  updatedAt: Date;
  createdAt: Date;
  resolvedAt: Date | null;
  sourceUrl: string | null;
  metadata: Prisma.JsonValue;
}): Incident {
  return toDomainIncident(
    row.id,
    {
      externalId: row.externalId,
      source: row.source,
      type: row.type,
      title: row.title,
      description: row.description,
      latitude: row.latitude,
      longitude: row.longitude,
      severity: row.severity,
      magnitude: row.magnitude,
      confidence: row.confidence,
      status: row.status,
      occurredAt: row.occurredAt,
      sourceUrl: row.sourceUrl,
      metadata: parseMetadata(row.metadata),
    },
    { createdAt: row.createdAt, updatedAt: row.updatedAt, resolvedAt: row.resolvedAt },
  );
}

function toRevision(row: {
  id: string;
  recordedAt: Date;
  summary: string;
  field: string;
  previous: string | null;
  next: string | null;
}): IncidentRevision {
  return {
    id: row.id,
    recordedAt: row.recordedAt.toISOString(),
    summary: row.summary,
    field: row.field,
    previous: row.previous,
    next: row.next,
  };
}

function orderBy(query: IncidentListQuery): Prisma.IncidentOrderByWithRelationInput {
  return { [query.sortBy]: query.sortOrder };
}
