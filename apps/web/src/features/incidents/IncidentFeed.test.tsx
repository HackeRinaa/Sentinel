import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { sampleIncident } from '@/test/fixtures';
import { IncidentFeed } from './IncidentFeed';

const baseProps = {
  isLoading: false,
  isError: false,
  onRetry: vi.fn(),
  highlightedIds: [],
  page: 1,
  totalPages: 1,
  total: 1,
  onPageChange: vi.fn(),
  hasActiveFilters: false,
  onClearFilters: vi.fn(),
  now: new Date('2026-10-05T12:00:00.000Z'),
};

describe('IncidentFeed', () => {
  it('selects an incident from the list and exposes severity as text', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <IncidentFeed
        {...baseProps}
        incidents={[sampleIncident()]}
        selectedId={null}
        onSelect={onSelect}
      />,
    );

    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('Earthquake — M 5.4')).toBeInTheDocument();
    await user.click(screen.getByRole('option'));
    expect(onSelect).toHaveBeenCalledWith('inc-1');
  });

  it('moves selection with the keyboard', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <IncidentFeed
        {...baseProps}
        total={2}
        incidents={[sampleIncident(), sampleIncident({ id: 'inc-2', title: 'M 4.4 - Crete' })]}
        selectedId={null}
        onSelect={onSelect}
      />,
    );

    await user.click(screen.getByRole('listbox'));
    await user.keyboard('{ArrowDown}');
    expect(onSelect).toHaveBeenCalledWith('inc-1');
  });

  it('shows an empty state that can clear filters', async () => {
    const user = userEvent.setup();
    const onClearFilters = vi.fn();
    render(
      <IncidentFeed
        {...baseProps}
        incidents={[]}
        total={0}
        selectedId={null}
        onSelect={vi.fn()}
        hasActiveFilters
        onClearFilters={onClearFilters}
      />,
    );
    expect(screen.getByText('No incidents match these filters')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(onClearFilters).toHaveBeenCalledOnce();
  });
});
