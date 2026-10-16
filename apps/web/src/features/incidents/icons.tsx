import { SEVERITY_LABELS, TYPE_LABELS, type IncidentType, type Severity } from '@sentinel/shared';
import { Activity, AlertTriangle, CloudLightning, Flame, Waves } from 'lucide-react';
import { severityTextClass } from '@/lib/format';
import { cn } from '@/lib/utils';

const typeIcons = {
  EARTHQUAKE: Activity,
  WILDFIRE: Flame,
  STORM: CloudLightning,
  FLOOD: Waves,
  OTHER: AlertTriangle,
} as const;

export function TypeIcon({ type, className }: { type: IncidentType; className?: string }) {
  const Icon = typeIcons[type];
  return <Icon className={className} aria-hidden="true" />;
}

export function SeverityMark({
  severity,
  compact = false,
}: {
  severity: Severity;
  compact?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
        severityTextClass(severity),
      )}
    >
      <SeverityGlyph severity={severity} />
      {compact ? null : SEVERITY_LABELS[severity]}
      {compact ? <span className="sr-only">{SEVERITY_LABELS[severity]}</span> : null}
    </span>
  );
}

function SeverityGlyph({ severity }: { severity: Severity }) {
  const common = 'h-2.5 w-2.5 fill-current';
  if (severity === 'LOW') {
    return <span className={cn(common, 'rounded-full bg-current')} aria-hidden="true" />;
  }
  if (severity === 'MODERATE') {
    return <span className={cn(common, 'bg-current')} aria-hidden="true" />;
  }
  if (severity === 'HIGH') {
    return (
      <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" aria-hidden="true">
        <path d="M6 1.2 11 10.5H1L6 1.2Z" className="fill-current" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" aria-hidden="true">
      <path
        d="M6 0.8 7.6 4.4 11.4 4.6 8.4 7.1 9.4 10.8 6 8.8 2.6 10.8 3.6 7.1 0.6 4.6 4.4 4.4 6 0.8Z"
        className="fill-current"
      />
    </svg>
  );
}

export function typeLabel(type: IncidentType): string {
  return TYPE_LABELS[type];
}
