import { buildSituationBrief, findSituations, type Incident } from '@sentinel/shared';
import { useMemo } from 'react';

export function SituationBrief({ incidents, now }: { incidents: Incident[]; now: Date }) {
  const text = useMemo(
    () => buildSituationBrief(incidents, findSituations(incidents), now),
    [incidents, now],
  );

  return (
    <p
      className="rounded-xl border border-line bg-panel px-4 py-3 text-sm leading-6"
      aria-live="polite"
    >
      {text}
    </p>
  );
}
