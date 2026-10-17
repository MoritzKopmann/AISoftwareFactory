import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { RunPanelDescription } from './describe-run-panel.js';
import { RunPanel } from './run-panel.js';

function render(description: RunPanelDescription): string {
  return renderToStaticMarkup(<RunPanel description={description} />);
}

describe('RunPanel', () => {
  it('should render nothing when the panel is hidden', () => {
    expect(render({ kind: 'hidden' })).toBe('');
  });

  it('should render nothing when the run is live, the session panel holds its head', () => {
    expect(
      render({
        kind: 'live',
        waiting: false,
        startedLabel: 'Started 4 min ago',
        stop: { label: 'Stop', pressable: true },
      }),
    ).toBe('');
  });

  it('should announce the reason and show no Stop when the run ended', () => {
    const markup = render({
      kind: 'ended',
      endedLabel: 'Ended 09:47 · ran 6 min',
      note: 'Run ended: you pressed Stop.',
    });
    expect(markup).toContain('aria-label="Run"');
    expect(markup).toContain('Ended 09:47 · ran 6 min');
    expect(markup).toMatch(/role="status"[^>]*>Run ended: you pressed Stop.</);
    expect(markup).not.toContain('<button');
    expect(markup).not.toContain('<ol');
  });
});
