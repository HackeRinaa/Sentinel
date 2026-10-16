import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sampleIncident } from '@/test/fixtures';
import { DashboardPage } from './DashboardPage';

vi.mock('@/features/map/IncidentMap', () => ({
  IncidentMap: ({ incidents }: { incidents: unknown[] }) => (
    <div>Incident map ({incidents.length})</div>
  ),
}));

vi.mock('@/features/analytics/IncidentCharts', () => ({
  IncidentCharts: () => <div>Incident charts</div>,
}));

vi.mock('@/services/realtime', () => ({
  startRealtime: () => () => undefined,
}));

const incident = sampleIncident();
const list = {
  data: [incident],
  meta: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
};
const stats = {
  active: 1,
  critical: 0,
  last24h: 1,
  byType: [
    { type: 'EARTHQUAKE', count: 1 },
    { type: 'WILDFIRE', count: 0 },
    { type: 'STORM', count: 0 },
    { type: 'FLOOD', count: 0 },
    { type: 'OTHER', count: 0 },
  ],
  bySeverity: [
    { severity: 'LOW', count: 0 },
    { severity: 'MODERATE', count: 0 },
    { severity: 'HIGH', count: 1 },
    { severity: 'CRITICAL', count: 0 },
  ],
  timeline: [{ bucket: '2026-10-05', count: 1 }],
};
const providers = {
  demoMode: true,
  api: 'operational',
  database: 'connected',
  lastSyncAt: '2026-10-05T12:00:00.000Z',
  connectedClients: 1,
  providers: [
    {
      name: 'demo',
      displayName: 'Demo simulator',
      status: 'operational',
      lastSuccessAt: '2026-10-05T12:00:00.000Z',
      lastAttemptAt: '2026-10-05T12:00:00.000Z',
      lastError: null,
      lastReceivedCount: 1,
      lastCreatedCount: 1,
      lastUpdatedCount: 0,
      lastRemovedCount: 0,
    },
  ],
};

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        const body = url.includes('/api/incidents/stats')
          ? { data: stats }
          : url.includes('/api/providers/status')
            ? { data: providers }
            : url.includes('/api/health')
              ? {
                  data: {
                    status: 'ok',
                    api: 'operational',
                    database: 'connected',
                    demoMode: true,
                    uptimeSeconds: 4,
                    timestamp: '2026-10-05T12:00:00.000Z',
                  },
                }
              : url.includes('/api/incidents/')
                ? { data: incident }
                : list;
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );
  });

  it('renders the operating picture from the API', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <DashboardPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('Earthquake — M 5.4')).toBeInTheDocument();
    expect(screen.getByText(/Demo mode/)).toBeInTheDocument();
    expect(screen.getByText('Incident map (1)')).toBeInTheDocument();
    expect(screen.getByText('Active incidents')).toBeInTheDocument();
  });
});
