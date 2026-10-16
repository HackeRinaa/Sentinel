# Sentinel API

Base URL in local development: `http://localhost:3001`

Successful responses use `data`. Collection responses also include `meta`.

```json
{
  "data": [],
  "meta": { "page": 1, "pageSize": 50, "total": 120, "totalPages": 3 }
}
```

Errors:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {},
    "requestId": "..."
  }
}
```

## Endpoints

### `GET /api/health`

Liveness and database connectivity. Returns `200` when the database answers and `503` when it does not.

### `GET /api/incidents`

Active incidents by default. Query parameters:

| Parameter                              | Description                                                              |
| -------------------------------------- | ------------------------------------------------------------------------ |
| `type`                                 | Comma-separated `EARTHQUAKE`, `WILDFIRE`, `STORM`, `FLOOD`, `OTHER`      |
| `severity`                             | Comma-separated `LOW`, `MODERATE`, `HIGH`, `CRITICAL`                    |
| `source`                               | Comma-separated provider ids (`usgs`, `eonet`, `demo`)                   |
| `startDate`, `endDate`                 | ISO date or datetime. A date-only end is inclusive through 23:59:59.999Z |
| `minSeverity`                          | Inclusive severity floor                                                 |
| `minLat`, `maxLat`, `minLng`, `maxLng` | Bounding box. All four are required together                             |
| `search`                               | Case-insensitive match on title and description                          |
| `status`                               | `ACTIVE` (default) or `RESOLVED`                                         |
| `page`                                 | Default `1`                                                              |
| `pageSize`                             | Default `50`, maximum `500`                                              |
| `sortBy`                               | `occurredAt`, `updatedAt`, `severity`, `magnitude`                       |
| `sortOrder`                            | `asc` or `desc`                                                          |

### `GET /api/incidents/:id`

One incident, or `404`. The payload includes `revisions`, newest first, capped at 12. Each revision has `summary`, `field`, `previous`, `next`, and `recordedAt`. List responses omit this log.

### `GET /api/incidents/stats`

Counts for the same filters, without pagination:

- `active` and `critical` count incidents that are still active
- `last24h` counts occurrences in the past 24 hours
- `byType` and `bySeverity` describe the active set
- `timeline` is a UTC-day series, defaulting to the last 7 days and capped at 31 days

### `GET /api/incidents/nearby?lat=&lng=&radiusKm=&limit=`

Active incidents inside a radius. Results include `distanceKm`. The server prefilters with a bounding box, then ranks with haversine distance.

### `GET /api/providers/status`

Runtime provider health, demo-mode flag, last successful sync, and connected WebSocket clients. This payload matches the `SYSTEM_STATUS` event.

## WebSocket

Connect to `ws://localhost:3001/ws` (or `/ws` on the same origin as the dashboard).

Each message is JSON:

```json
{
  "type": "INCIDENT_CREATED",
  "timestamp": "2026-10-05T12:00:00.000Z",
  "payload": { "incident": {} }
}
```

| Type               | When                                                                                |
| ------------------ | ----------------------------------------------------------------------------------- |
| `INCIDENT_CREATED` | A provider reported an incident the database had not stored                         |
| `INCIDENT_UPDATED` | A stored incident materially changed                                                |
| `INCIDENT_REMOVED` | An incident disappeared from a successful provider snapshot and was marked resolved |
| `SYSTEM_STATUS`    | Sent on connect and after every provider attempt                                    |

The first successful sync for each provider is persisted without incident broadcasts, so connecting clients load the snapshot over HTTP and then receive deltas.

Browser origins are checked against `CORS_ORIGIN`. Clients that omit `Origin` are allowed.
