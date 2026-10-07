import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { RunLogDescription } from '../../src/tickets/describe-run-log.js';
import { RunLogView } from '../../src/tickets/run-log.js';

const ignore = () => undefined;

function render(description: RunLogDescription): string {
  return renderToStaticMarkup(
    <RunLogView description={description} onToggle={ignore} onRetry={ignore} />,
  );
}

describe('RunLogView', () => {
  it('should render a closed section with the Show log toggle and no count when the log is closed', () => {
    const markup = render({ kind: 'closed' });
    expect(markup).toMatch(/^<details class="row runlog">/);
    expect(markup).toContain('Run log');
    expect(markup).toContain('Show log');
    expect(markup).not.toContain('class="n"');
    expect(markup).toMatch(/<\/summary><\/details>$/);
  });

  it('should open, mark the section busy and announce the loading label when the log is loading', () => {
    const markup = render({ kind: 'loading', loadingLabel: 'Loading the run log…' });
    expect(markup).toMatch(/^<details[^>]* open=""/);
    expect(markup).toMatch(/^<details[^>]* aria-busy="true"/);
    expect(markup).toMatch(/role="status"[^>]*>Loading the run log…</);
  });

  it('should show the count, the note and a keyboard-scrollable labelled list of numbered entries in order when entries are described', () => {
    const markup = render({
      kind: 'entries',
      countLabel: '1,284',
      note: 'Showing last 200 of 1,284.',
      entries: [
        { indexLabel: '1085', summary: 'Read retry-policy.ts' },
        { indexLabel: '1086', summary: 'Bash: npm test' },
      ],
    });
    expect(markup).toContain('>1,284<');
    expect(markup).toContain('>Showing last 200 of 1,284.<');
    expect(markup).toMatch(/<ol[^>]* tabindex="0"/);
    expect(markup).toMatch(/<ol[^>]* aria-label="Run log entries"/);
    expect(markup).toMatch(/>1085<.*>Read retry-policy\.ts<.*>1086<.*>Bash: npm test</);
    expect(markup).not.toContain('aria-busy');
  });

  it('should show the message as a status and not as an alert when a quiet message is described', () => {
    const markup = render({ kind: 'message', message: 'No session yet.' });
    expect(markup).toMatch(/role="status"[^>]*>No session yet\.</);
    expect(markup).not.toContain('role="alert"');
    expect(markup).not.toContain('class="n"');
  });

  it('should announce the failure as an alert with a Retry button and the detail line when the fetch failed', () => {
    const markup = render({
      kind: 'failed',
      message: "Couldn't load the run log. Can't reach aisf.",
      detail: 'Failed to fetch',
    });
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('Couldn&#x27;t load the run log. Can&#x27;t reach aisf.');
    expect(markup).toMatch(/<button[^>]*>Retry<\/button>/);
    expect(markup).toContain('>Failed to fetch<');
  });
});
