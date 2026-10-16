import type { HealthStatus, ProviderStatus, SystemStatusPayload } from '@sentinel/shared';
import { formatTimestamp } from '@/lib/format';
import { connectionLabel, type ConnectionStatus } from '@/stores/connection-store';

export function SystemStatusPanel({
  health,
  providers,
  connection,
}: {
  health: HealthStatus | undefined;
  providers: SystemStatusPayload | undefined;
  connection: ConnectionStatus;
}) {
  const lastSync = providers?.lastSyncAt
    ? formatTimestamp(providers.lastSyncAt).local
    : 'Waiting for sync';
  return (
    <div className="space-y-3 text-sm">
      <StatusRow
        label="API"
        value={health?.api === 'operational' ? 'Operational' : 'Unknown'}
        tone={health ? 'good' : 'idle'}
      />
      <StatusRow
        label="Database"
        value={health?.database === 'connected' ? 'Connected' : health ? 'Disconnected' : 'Unknown'}
        tone={health?.database === 'connected' ? 'good' : health ? 'bad' : 'idle'}
      />
      <StatusRow
        label="WebSocket"
        value={connectionLabel(connection)}
        tone={connection === 'connected' ? 'good' : connection === 'offline' ? 'bad' : 'idle'}
      />
      <div>
        <p className="mb-1 text-xs uppercase tracking-[0.14em] text-subtle">Data providers</p>
        <div className="space-y-2">
          {(providers?.providers ?? []).map((provider) => (
            <ProviderRow key={provider.name} provider={provider} />
          ))}
          {!providers || providers.providers.length === 0 ? (
            <p className="text-subtle">No providers reported yet.</p>
          ) : null}
        </div>
      </div>
      <p className="text-xs text-subtle">Last successful sync: {lastSync}</p>
      {typeof providers?.connectedClients === 'number' ? (
        <p className="text-xs text-subtle">{providers.connectedClients} websocket clients</p>
      ) : null}
    </div>
  );
}

function ProviderRow({ provider }: { provider: ProviderStatus }) {
  const tone =
    provider.status === 'operational' ? 'good' : provider.status === 'down' ? 'bad' : 'idle';
  const label =
    provider.status === 'operational'
      ? 'Operational'
      : provider.status === 'down'
        ? 'Down'
        : 'Waiting';
  return (
    <div>
      <StatusRow label={provider.displayName} value={label} tone={tone} />
      {provider.lastError ? (
        <p className="mt-1 text-xs text-rose-500">{provider.lastError}</p>
      ) : null}
    </div>
  );
}

function StatusRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'good' | 'bad' | 'idle';
}) {
  const color =
    tone === 'good' ? 'bg-emerald-500' : tone === 'bad' ? 'bg-rose-500' : 'bg-amber-400';
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <span className="inline-flex items-center gap-2 text-xs">
        <span className={`h-2 w-2 rounded-full ${color}`} aria-hidden="true" />
        {value}
      </span>
    </div>
  );
}
