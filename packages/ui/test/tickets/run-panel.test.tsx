import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { RunPanelDescription } from '../../src/tickets/describe-run-panel.js';
import { RunPanel } from '../../src/tickets/run-panel.js';

const ignoreStop = () => undefined;

const live: Extract<RunPanelDescription, { kind: 'live' }> = {
  kind: 'live',
  startedLabel: 'Started 4 min ago',
  stop: { label: 'Stop', pressable: true },
  steps: [
    { at: '2026-09-30T09:41:19Z', time: '09:41:19', summary: 'Wrote a test', latest: false },
    { at: '2026-09-30T09:41:52Z', time: '09:41:52', summary: 'Bash: npm test', latest: true },
  ],
};

function render(description: RunPanelDescription): string {
  return renderToStaticMarkup(<RunPanel description={description} onStop={ignoreStop} />);
}

describe('RunPanel', () => {
  it('should render nothing when the panel is hidden', () => {
    expect(render({ kind: 'hidden' })).toBe('');
  });

  it('should render a labelled Run region with a pressable Stop when the run is live', () => {
    const markup = render(live);
    expect(markup).toContain('aria-label="Run"');
    expect(markup).toMatch(/<button[^>]*>Stop<\/button>/);
    expect(markup).not.toContain('aria-disabled');
  });

  it('should give each step its full text as a title and mark only the newest as latest', () => {
    const markup = render(live);
    expect(markup).toContain('<time dateTime="2026-09-30T09:41:52Z">09:41:52</time>');
    expect(markup).toContain('title="Wrote a test"');
    expect(markup).toContain('title="Bash: npm test"');
    expect(markup.match(/\(latest step\)/g)).toHaveLength(1);
    expect(markup).toMatch(/Bash: npm test<span class="vh"> \(latest step\)<\/span>/);
  });

  it('should keep the Stopping… button focusable and announce it when Stop was pressed', () => {
    const markup = render({
      ...live,
      stop: { label: 'Stopping…', pressable: false, announcement: 'Stopping the run' },
    });
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).not.toMatch(/\sdisabled=""/);
    expect(markup).toContain('Stopping…');
    expect(markup).toMatch(/role="status"[^>]*>Stopping the run</);
  });

  it('should announce the starting line when the run has no steps yet', () => {
    const markup = render({ ...live, steps: [], emptyMessage: 'Starting the session.' });
    expect(markup).toMatch(/<li[^>]*role="status"[^>]*>Starting the session.<\/li>/);
  });

  it('should announce the banner and keep the steps when the poll failed', () => {
    const markup = render({ ...live, banner: "Can't reach aisf." });
    expect(markup).toMatch(/role="status"[^>]*>.*Can&#x27;t reach aisf./);
    expect(markup).toContain('Bash: npm test');
  });

  it('should announce the reason and show no Stop and no steps when the run ended', () => {
    const markup = render({
      kind: 'ended',
      endedLabel: 'Ended 09:47 · ran 6 min',
      note: 'Run ended: you pressed Stop.',
    });
    expect(markup).toContain('Ended 09:47 · ran 6 min');
    expect(markup).toMatch(/role="status"[^>]*>Run ended: you pressed Stop.</);
    expect(markup).not.toContain('<button');
    expect(markup).not.toContain('<ol');
  });
});
