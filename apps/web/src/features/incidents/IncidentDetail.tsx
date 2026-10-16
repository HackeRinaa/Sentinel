import {
  SEVERITY_LABELS,
  sourceLabel,
  TYPE_LABELS,
  type Incident,
  type IncidentDetail as IncidentDetailRecord,
  type Situation,
} from '@sentinel/shared';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  externalUrl,
  formatConfidence,
  formatCoordinates,
  formatMetric,
  formatPlace,
  formatTimestamp,
} from '@/lib/format';
import { SeverityMark, TypeIcon } from './icons';

const metadataLabels: Record<string, string> = {
  depthKm: 'Depth (km)',
  place: 'Location',
  magType: 'Magnitude type',
  reviewStatus: 'Review status',
  tsunami: 'Tsunami flag',
  acres: 'Reported size (acres)',
  containmentPct: 'Containment (%)',
  category: 'Category',
  sources: 'Contributing sources',
  revisedAt: 'Revision time',
  parentExternalId: 'Related event',
  simulated: 'Simulated',
  sourceUpdatedAt: 'Source updated',
};

export function IncidentDetail({
  incident,
  related = [],
  onSelectRelated,
}: {
  incident: IncidentDetailRecord;
  related?: Array<{ situation: Situation; other: Incident }>;
  onSelectRelated?: (id: string) => void;
}) {
  const link = externalUrl(incident.sourceUrl);
  const occurred = formatTimestamp(incident.occurredAt);
  const updated = formatTimestamp(incident.updatedAt);
  const confidence = formatConfidence(incident.confidence);

  const copyCoordinates = async () => {
    try {
      await navigator.clipboard.writeText(`${incident.latitude}, ${incident.longitude}`);
      toast.success('Coordinates copied');
    } catch {
      toast.error('Could not copy coordinates');
    }
  };

  return (
    <article className="space-y-5">
      <div className="flex items-center gap-2">
        <TypeIcon type={incident.type} className="h-4 w-4" />
        <span className="text-sm text-subtle">{TYPE_LABELS[incident.type]}</span>
        <SeverityMark severity={incident.severity} />
      </div>
      <p className="text-sm leading-6 text-foreground">{incident.description}</p>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <DetailItem label="Metric" value={formatMetric(incident)} />
        <DetailItem label="Severity" value={SEVERITY_LABELS[incident.severity]} />
        <DetailItem label="Source" value={sourceLabel(incident.source)} />
        <DetailItem label="Status" value={incident.status === 'ACTIVE' ? 'Active' : 'Resolved'} />
        <DetailItem label="Location" value={formatPlace(incident)} />
        <DetailItem
          label="Coordinates"
          value={formatCoordinates(incident.latitude, incident.longitude)}
        />
        {incident.magnitude !== null ? (
          <DetailItem label="Magnitude" value={incident.magnitude.toFixed(1)} />
        ) : null}
        {confidence ? <DetailItem label="Confidence" value={confidence} /> : null}
        <DetailItem label="Occurred" value={`${occurred.local} (${occurred.utc})`} />
        <DetailItem label="Updated" value={`${updated.local} (${updated.utc})`} />
        <DetailItem label="External id" value={incident.externalId} mono />
      </dl>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => void copyCoordinates()}>
          Copy coordinates
        </Button>
        {link ? (
          <a
            className="inline-flex h-8 items-center rounded-md bg-accent px-2.5 text-xs font-medium text-accent-contrast"
            href={link}
            target="_blank"
            rel="noreferrer"
          >
            Open original source
          </a>
        ) : null}
      </div>
      {related.length > 0 ? (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-subtle">
            Compound situations
          </h3>
          <ul className="mt-2 space-y-2">
            {related.map(({ situation, other }) => (
              <li key={situation.id}>
                <button
                  type="button"
                  className="w-full rounded-lg border border-line bg-panel-muted px-3 py-2 text-left text-sm hover:bg-panel"
                  onClick={() => onSelectRelated?.(other.id)}
                >
                  <span className="block font-medium">{other.title}</span>
                  <span className="mt-1 block text-xs text-subtle">{situation.summary}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {incident.revisions.length > 0 ? (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-subtle">
            What changed
          </h3>
          <ol className="mt-2 space-y-2">
            {incident.revisions.map((revision) => (
              <li key={revision.id} className="rounded-lg border border-line px-3 py-2 text-sm">
                <p>{revision.summary}</p>
                <time
                  className="mt-1 block font-mono text-[11px] text-subtle"
                  dateTime={revision.recordedAt}
                >
                  {formatTimestamp(revision.recordedAt).local}
                </time>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-subtle">Metadata</h3>
        <dl className="mt-2 space-y-2 text-sm">
          {Object.entries(incident.metadata).map(([key, value]) => (
            <div key={key} className="flex justify-between gap-4 border-b border-line py-1.5">
              <dt className="text-subtle">{metadataLabels[key] ?? key}</dt>
              <dd className="text-right font-mono text-xs">{formatMetadataValue(value)}</dd>
            </div>
          ))}
        </dl>
      </section>
    </article>
  );
}

function DetailItem({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg bg-panel-muted px-3 py-2">
      <dt className="text-[11px] uppercase tracking-wide text-subtle">{label}</dt>
      <dd className={mono ? 'mt-1 break-all font-mono text-xs' : 'mt-1'}>{value}</dd>
    </div>
  );
}

function formatMetadataValue(value: string | number | boolean | null): string {
  if (value === null) {
    return '—';
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  return String(value);
}
