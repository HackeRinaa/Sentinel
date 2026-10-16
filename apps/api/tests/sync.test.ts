import { describe, expect, it } from 'vitest';
import { MemoryIncidentRepository } from '../src/repositories/memory-repository.js';
import { makeNormalized } from './helpers.js';

describe('snapshot synchronization', () => {
  it('creates, updates, and resolves incidents', async () => {
    const repository = new MemoryIncidentRepository();
    const created = await repository.applySnapshot('usgs', [makeNormalized()], {
      allowRemovals: true,
    });
    expect(created.created).toHaveLength(1);
    expect(created.updated).toHaveLength(0);

    const updated = await repository.applySnapshot(
      'usgs',
      [makeNormalized({ magnitude: 5.1, severity: 'HIGH', title: 'M 5.1 - revised' })],
      { allowRemovals: true },
    );
    expect(updated.created).toHaveLength(0);
    expect(updated.updated).toHaveLength(1);
    expect(updated.updated[0]?.magnitude).toBe(5.1);
    const detail = await repository.findById(updated.updated[0]?.id ?? '');
    expect(detail?.revisions[0]?.summary).toBe('Magnitude revised from 4.5 to 5.1');

    const removed = await repository.applySnapshot('usgs', [], { allowRemovals: true });
    expect(removed.removed).toHaveLength(1);
    expect(removed.removed[0]?.status).toBe('RESOLVED');
    const resolved = await repository.findById(removed.removed[0]?.id ?? '');
    expect(resolved?.revisions.some((revision) => revision.field === 'status')).toBe(true);
    expect(await repository.countActiveBySource('usgs')).toBe(0);
  });

  it('does not resolve the catalog when removals are disabled', async () => {
    const repository = new MemoryIncidentRepository();
    await repository.applySnapshot('usgs', [makeNormalized()], { allowRemovals: true });
    const result = await repository.applySnapshot('usgs', [], { allowRemovals: false });
    expect(result.removed).toHaveLength(0);
    expect(await repository.countActiveBySource('usgs')).toBe(1);
  });
});
