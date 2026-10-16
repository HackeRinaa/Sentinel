import {
  INCIDENT_TYPES,
  KNOWN_SOURCES,
  SEVERITIES,
  SEVERITY_LABELS,
  TYPE_LABELS,
} from '@sentinel/shared';
import { Search, X } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { countActiveFilters } from '@/lib/filters';
import { useFilterStore } from '@/stores/filter-store';

export function FilterBar() {
  const filters = useFilterStore();
  const search = useFilterStore((state) => state.search);
  const setDebouncedSearch = useFilterStore((state) => state.setDebouncedSearch);
  const activeCount = countActiveFilters(filters);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search, setDebouncedSearch]);

  return (
    <div className="border-b border-line p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-40 flex-1">
          <Search
            className="pointer-events-none absolute left-2 top-2 h-4 w-4 text-subtle"
            aria-hidden="true"
          />
          <Input
            value={filters.search}
            onChange={(event) => filters.setSearch(event.target.value)}
            placeholder="Search title or place"
            aria-label="Search incidents"
            className="pl-8"
            onKeyDown={(event) => {
              if (event.key === '/' && event.currentTarget !== document.activeElement) {
                event.preventDefault();
              }
            }}
          />
        </div>
        <MultiSelect
          label="Type"
          options={INCIDENT_TYPES.map((type) => ({ value: type, label: TYPE_LABELS[type] }))}
          selected={filters.types}
          onToggle={(value) => filters.toggleType(value)}
        />
        <MultiSelect
          label="Severity"
          options={SEVERITIES.map((severity) => ({
            value: severity,
            label: SEVERITY_LABELS[severity],
          }))}
          selected={filters.severities}
          onToggle={(value) => filters.toggleSeverity(value)}
        />
        <MultiSelect
          label="Source"
          options={KNOWN_SOURCES.map((source) => ({ value: source.id, label: source.label }))}
          selected={filters.sources}
          onToggle={(value) => filters.toggleSource(value)}
        />
        <Button
          type="button"
          variant={filters.limitToMapView ? 'default' : 'outline'}
          size="sm"
          aria-pressed={filters.limitToMapView}
          onClick={() => filters.setLimitToMapView(!filters.limitToMapView)}
        >
          Map area
        </Button>
        {activeCount > 0 ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => filters.clear()}>
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            Clear
            <span className="rounded-full bg-accent-soft px-1.5 text-[11px]">{activeCount}</span>
          </Button>
        ) : null}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="text-[11px] text-subtle">
          From
          <Input
            type="date"
            value={filters.startDate}
            onChange={(event) => filters.setStartDate(event.target.value)}
            aria-label="Start date"
            className="mt-1"
          />
        </label>
        <label className="text-[11px] text-subtle">
          To
          <Input
            type="date"
            value={filters.endDate}
            onChange={(event) => filters.setEndDate(event.target.value)}
            aria-label="End date"
            className="mt-1"
          />
        </label>
      </div>
    </div>
  );
}

function MultiSelect<T extends string>({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: Array<{ value: T; label: string }>;
  selected: T[];
  onToggle: (value: T) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" aria-label={`Filter by ${label}`}>
          {label}
          {selected.length > 0 ? (
            <span className="rounded-full bg-accent-soft px-1.5 text-[11px]">
              {selected.length}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent>
        <fieldset className="space-y-1">
          <legend className="px-1 pb-1 text-xs font-medium text-subtle">{label}</legend>
          {options.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-panel-muted"
            >
              <input
                type="checkbox"
                checked={selected.includes(option.value)}
                onChange={() => onToggle(option.value)}
              />
              {option.label}
            </label>
          ))}
        </fieldset>
      </PopoverContent>
    </Popover>
  );
}
