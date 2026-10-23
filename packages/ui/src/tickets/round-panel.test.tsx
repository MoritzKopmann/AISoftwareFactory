import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { RoundPanelDescription } from './describe-round-panel.js';
import { RoundPanel } from './round-panel.js';

const shown: RoundPanelDescription = {
  kind: 'shown',
  title: 'Plan round 2',
  url: '/pages/a/index.html',
  subtitle: 'Plan #412 · Plan round 2',
  stop: { label: 'Stop', pressable: true },
};

function render(description: RoundPanelDescription): string {
  return renderToStaticMarkup(<RoundPanel description={description} onStop={() => undefined} />);
}

describe('RoundPanel', () => {
  it('should render nothing when hidden', () => {
    expect(render({ kind: 'hidden' })).toBe('');
  });

  it('should render Waiting for you, the subtitle, a pressable Stop and an iframe on the url when shown', () => {
    const markup = render(shown);
    expect(markup).toContain('Waiting for you');
    expect(markup).toContain('Plan #412 · Plan round 2');
    expect(markup).toMatch(/<button[^>]*>Stop<\/button>/);
    expect(markup).not.toContain('aria-disabled');
    expect(markup).toMatch(/<iframe[^>]*src="\/pages\/a\/index.html"/);
  });

  it('should render an open-page link before Stop when shown', () => {
    const markup = render({ ...shown, url: '/a/tok/', title: 'Plan round 2' });
    expect(markup).toMatch(
      /<a[^>]*class="btn ext"[^>]*href="\/a\/tok\/"[^>]*target="_blank"[^>]*aria-label="Open Plan round 2 in its own tab"[^>]*><\/a><button[^>]*>Stop<\/button>/,
    );
  });

  it('should render the open-page link when shown without Stop', () => {
    const markup = render({
      kind: 'shown',
      title: shown.title,
      url: shown.url,
      subtitle: shown.subtitle,
    });
    expect(markup).toContain('aria-label="Open Plan round 2 in its own tab"');
  });

  it('should mark the section busy and keep the iframe mounted but hidden until it loads', () => {
    const markup = render(shown);
    expect(markup).toMatch(/<section[^>]*aria-busy="true"/);
    expect(markup).toMatch(/<iframe[^>]*hidden=""/);
  });

  it('should keep Stopping… focusable and announce it when Stop was pressed', () => {
    const markup = render({
      ...shown,
      stop: { label: 'Stopping…', pressable: false, announcement: 'Stopping the run' },
    });
    expect(markup).toMatch(/<button[^>]*aria-disabled="true"[^>]*>Stopping…<\/button>/);
    expect(markup).toMatch(/role="status"[^>]*>Stopping the run</);
  });

  it('should show Run ended, its label and note, with no Stop and no iframe, when ended', () => {
    const markup = render({
      kind: 'ended',
      endedLabel: 'Ended 14:22 · 18 min',
      note: 'The run ended before this round was answered.',
    });
    expect(markup).toContain('Run ended');
    expect(markup).toContain('Ended 14:22 · 18 min');
    expect(markup).toContain('The run ended before this round was answered.');
    expect(markup).not.toContain('<button');
    expect(markup).not.toContain('<iframe');
    expect(markup).not.toContain('Open Plan');
    expect(markup).not.toContain('btn ext');
  });
});
