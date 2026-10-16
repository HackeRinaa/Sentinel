import { describe, expect, it } from 'vitest';
import { escapeHtml, externalUrl, formatMetric, formatRelativeTime } from './format';
import { sampleIncident } from '@/test/fixtures';

describe('formatters', () => {
  it('formats earthquake magnitude and wildfire confidence', () => {
    expect(formatMetric(sampleIncident())).toBe('M 5.4');
    expect(
      formatMetric(
        sampleIncident({
          type: 'WILDFIRE',
          magnitude: null,
          confidence: 0.86,
          title: 'Park Fire',
        }),
      ),
    ).toBe('High confidence');
  });

  it('uses a short relative label for events that just arrived', () => {
    const now = new Date('2026-10-05T12:00:05.000Z');
    expect(formatRelativeTime('2026-10-05T12:00:00.000Z', now)).toBe('just now');
  });

  it('escapes popup text and rejects non-http links', () => {
    expect(escapeHtml(`<img src="x" onerror='alert(1)'>`)).toBe(
      '&lt;img src=&quot;x&quot; onerror=&#39;alert(1)&#39;&gt;',
    );
    expect(externalUrl('javascript:alert(1)')).toBeNull();
    expect(externalUrl('https://earthquake.usgs.gov/earthquakes/map/')).toContain('https://');
  });
});
