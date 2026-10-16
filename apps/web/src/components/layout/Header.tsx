import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SystemStatusPanel } from '@/features/system-status/SystemStatusPanel';
import { useHealth, useProviderStatus } from '@/hooks/use-incidents';
import { formatTimestamp } from '@/lib/format';
import { connectionLabel, useConnectionStore } from '@/stores/connection-store';
import { useThemeStore } from '@/stores/theme-store';

export function Header() {
  const theme = useThemeStore((state) => state.theme);
  const toggle = useThemeStore((state) => state.toggle);
  const connection = useConnectionStore((state) => state.status);
  const health = useHealth();
  const providers = useProviderStatus();
  const lastSync = providers.data?.lastSyncAt ? formatTimestamp(providers.data.lastSyncAt) : null;
  const tone =
    connection === 'connected'
      ? 'bg-emerald-400'
      : connection === 'offline'
        ? 'bg-rose-500'
        : 'bg-amber-400';

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-panel/80 px-4 py-3 backdrop-blur">
      <div className="flex items-center gap-3">
        <img src="/favicon.svg" alt="" className="h-8 w-8" />
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-subtle">
            Incident intelligence
          </p>
          <h1 className="text-lg font-semibold tracking-tight">Sentinel</h1>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm" aria-label="Open system status">
              <span
                className={`h-2 w-2 rounded-full ${tone} ${connection === 'connected' ? 'live-dot' : ''}`}
                aria-hidden="true"
              />
              <span aria-live="polite">{connectionLabel(connection)}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <SystemStatusPanel
              health={health.data}
              providers={providers.data}
              connection={connection}
            />
          </PopoverContent>
        </Popover>
      </div>
      <p className="text-xs text-subtle">
        Last updated{' '}
        <time dateTime={providers.data?.lastSyncAt ?? undefined}>
          {lastSync ? lastSync.local : 'waiting for sync'}
        </time>
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={toggle}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <span className="hidden text-xs text-subtle sm:inline">Local operator</span>
      </div>
    </header>
  );
}
