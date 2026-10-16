# Contributing

Sentinel is a small monorepo. Keep changes focused, typed, and covered by a test when they change behavior.

## Setup

1. Install Node.js 22 and pnpm 10.
2. Copy `.env.example` to `.env`.
3. Start PostgreSQL with `docker compose up db -d`.
4. Run `pnpm install`, `pnpm db:generate`, and `pnpm db:migrate`.
5. Run `pnpm dev`.

## Checks

Before opening a pull request, run:

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

GitHub Actions runs the same sequence.

## Conventions

- TypeScript `strict` is required. Do not introduce `any`.
- Validate external input with Zod.
- Keep provider-specific code behind `IncidentProvider`.
- Keep route handlers thin. Persistence and ingestion live in repositories and services.
- Do not commit `.env` files or credentials.
- Demo incidents must stay clearly labeled as simulated.

## Adding a data source

1. Implement `IncidentProvider`.
2. Normalize records into `NormalizedIncident`.
3. Register the provider in `createProviders`.
4. Add a unit test with a fixture payload, including a malformed record that must be skipped.
