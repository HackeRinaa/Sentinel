import { sourceLabel, type Incident } from '@sentinel/shared';
import { memo, type KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatFeedTitle, formatPlace, formatRelativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { SeverityMark, TypeIcon } from './icons';

interface IncidentFeedProps {
  incidents: Incident[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  highlightedIds: string[];
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  now: Date;
}

export function IncidentFeed({
  incidents,
  isLoading,
  isError,
  onRetry,
  selectedId,
  onSelect,
  highlightedIds,
  page,
  totalPages,
  total,
  onPageChange,
  hasActiveFilters,
  onClearFilters,
  now,
}: IncidentFeedProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (incidents.length === 0) {
      return;
    }
    const currentIndex = incidents.findIndex((item) => item.id === selectedId);
    const selectAt = (index: number) => {
      const next = incidents[index];
      if (next) {
        onSelect(next.id);
      }
    };
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      selectAt(currentIndex < 0 ? 0 : Math.min(incidents.length - 1, currentIndex + 1));
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      selectAt(currentIndex < 0 ? 0 : Math.max(0, currentIndex - 1));
    }
    if (event.key === 'Home') {
      event.preventDefault();
      selectAt(0);
    }
    if (event.key === 'End') {
      event.preventDefault();
      selectAt(incidents.length - 1);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-3 py-2 text-xs text-subtle">
        <span>Live feed</span>
        <span>{total} active</span>
      </div>
      {isLoading ? (
        <div className="space-y-2 px-3" aria-busy="true" aria-live="polite">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-16" />
          ))}
        </div>
      ) : null}
      {isError ? (
        <div className="m-3 rounded-lg border border-line bg-panel-muted p-4 text-sm" role="alert">
          <p className="font-medium">Unable to load incidents</p>
          <p className="mt-1 text-subtle">The feed could not be reached. Retry the request.</p>
          <Button type="button" className="mt-3" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </div>
      ) : null}
      {!isLoading && !isError && incidents.length === 0 ? (
        <div className="m-3 rounded-lg border border-dashed border-line p-4 text-sm">
          <p className="font-medium">No incidents match these filters</p>
          <p className="mt-1 text-subtle">
            {hasActiveFilters
              ? 'Clear filters to see the current operating picture.'
              : 'The next synchronization will populate this feed.'}
          </p>
          {hasActiveFilters ? (
            <Button
              type="button"
              className="mt-3"
              size="sm"
              variant="outline"
              onClick={onClearFilters}
            >
              Clear filters
            </Button>
          ) : null}
        </div>
      ) : null}
      {!isLoading && !isError && incidents.length > 0 ? (
        <div
          id="incident-listbox"
          role="listbox"
          aria-label="Live incidents"
          aria-activedescendant={selectedId ? `incident-option-${selectedId}` : undefined}
          tabIndex={0}
          onKeyDown={onKeyDown}
          className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-2 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
        >
          {incidents.map((incident) => (
            <IncidentFeedItem
              key={incident.id}
              incident={incident}
              selected={incident.id === selectedId}
              highlighted={highlightedIds.includes(incident.id)}
              now={now}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : null}
      {totalPages > 1 ? (
        <nav
          className="flex items-center justify-between border-t border-line px-3 py-2"
          aria-label="Incident pages"
        >
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </Button>
          <span className="text-xs text-subtle">
            Page {page} of {totalPages}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </nav>
      ) : null}
    </div>
  );
}

const IncidentFeedItem = memo(function IncidentFeedItem({
  incident,
  selected,
  highlighted,
  now,
  onSelect,
}: {
  incident: Incident;
  selected: boolean;
  highlighted: boolean;
  now: Date;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      id={`incident-option-${incident.id}`}
      role="option"
      aria-selected={selected}
      tabIndex={selected ? 0 : -1}
      onClick={() => onSelect(incident.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(incident.id);
        }
      }}
      className={cn(
        'cursor-pointer rounded-lg border border-transparent px-2 py-2 outline-none hover:bg-panel-muted focus-visible:ring-2 focus-visible:ring-accent',
        selected && 'border-line bg-accent-soft',
        highlighted && 'sentinel-flash',
      )}
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 rounded-md bg-panel-muted p-1.5 text-subtle">
          <TypeIcon type={incident.type} className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <span className="truncate text-sm font-medium">{formatFeedTitle(incident)}</span>
            <time
              className="shrink-0 font-mono text-[11px] text-subtle"
              dateTime={incident.occurredAt}
            >
              {formatRelativeTime(incident.occurredAt, now)}
            </time>
          </span>
          <span className="mt-0.5 block truncate text-xs text-subtle">{incident.title}</span>
          <span className="mt-1 flex items-center justify-between gap-2">
            <span className="truncate text-xs text-subtle">
              {formatPlace(incident)} · {sourceLabel(incident.source)}
            </span>
            <SeverityMark severity={incident.severity} />
          </span>
        </span>
      </div>
    </div>
  );
});
