import { SEVERITIES, SEVERITY_COLORS, SEVERITY_LABELS } from '@sentinel/shared';

export function MapLegend() {
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-[400] rounded-lg border border-line bg-panel/95 px-3 py-2 text-xs shadow-[var(--shadow)]">
      <p className="mb-1 font-medium text-subtle">Severity</p>
      <ul className="space-y-1">
        {SEVERITIES.map((severity) => (
          <li key={severity} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: SEVERITY_COLORS[severity] }}
              aria-hidden="true"
            />
            <span>{SEVERITY_LABELS[severity]}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 border-t border-line pt-2 text-subtle">Dashed line: compound situation</p>
    </div>
  );
}
