import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { LiveRunDescription } from './describe-run-panel.js';
import type { SessionPanelDescription } from './describe-session-panel.js';
import { SessionPanel } from './session-panel.js';

const ignore = () => undefined;

const connectionBanner = {
  line: 'Connection lost. Reconnecting…',
  note: 'What is shown stays. New entries continue once it is back.',
};

const liveRun: LiveRunDescription = {
  kind: 'live',
  waiting: false,
  startedLabel: 'Started 4 min ago',
  stop: { label: 'Stop', pressable: true },
};

function liveDescription(run: LiveRunDescription): SessionPanelDescription {
  return { label: 'Run', rail: 'info', head: { kind: 'live', run } };
}

function render(description: SessionPanelDescription): string {
  return renderToStaticMarkup(
    <SessionPanel description={description} onStop={ignore} onRetry={ignore}>
      <p>CONTENT</p>
    </SessionPanel>,
  );
}

describe('SessionPanel', () => {
  it('should render a Run region with an info rail and a pressable Stop when the run is live', () => {
    const markup = render(liveDescription(liveRun));
    expect(markup).toContain(
      'class="session-panel rail-info" id="ticket-session" aria-label="Run"',
    );
    expect(markup).toMatch(/<button[^>]*>Stop<\/button>/);
    expect(markup).not.toContain('aria-disabled');
  });

  it('should show Running with the started label when the run is live', () => {
    const markup = render(liveDescription(liveRun));
    expect(markup).toContain('Running');
    expect(markup).toContain('Started 4 min ago');
  });

  it('should show Waiting for you with the hitl mark, no pulse and a pressable Stop when the run waits', () => {
    const markup = render(liveDescription({ ...liveRun, waiting: true }));
    expect(markup).toContain('Waiting for you');
    expect(markup).toContain('s-hitl');
    expect(markup).not.toContain('pulse');
    expect(markup).not.toContain('Running');
    expect(markup).toMatch(/<button[^>]*>Stop<\/button>/);
  });

  it('should keep the pulsing Running head when the run works', () => {
    const markup = render(liveDescription({ ...liveRun, waiting: false }));
    expect(markup).toContain('pulse');
  });

  it('should keep the Stopping… button focusable and announce it when Stop was pressed', () => {
    const markup = render(
      liveDescription({
        ...liveRun,
        stop: { label: 'Stopping…', pressable: false, announcement: 'Stopping the run' },
      }),
    );
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).not.toMatch(/\sdisabled=""/);
    expect(markup).toContain('Stopping…');
    expect(markup).toMatch(/role="status"[^>]*>Stopping the run</);
  });

  it('should announce the banner between the head and the chat when the poll failed', () => {
    const markup = render(liveDescription({ ...liveRun, banner: "Can't reach aisf." }));
    expect(markup).toMatch(/role="status"[^>]*>.*Can&#x27;t reach aisf./);
    expect(markup.indexOf('inline-banner')).toBeGreaterThan(markup.indexOf('Stop'));
    expect(markup.indexOf('inline-banner')).toBeLessThan(markup.indexOf('role="log"'));
  });

  it('should put a Retry button under the banner message when the poll failed', () => {
    const markup = render(liveDescription({ ...liveRun, banner: "Can't reach aisf." }));
    expect(markup).toMatch(
      /class="inline-banner".*<p class="sm">Can&#x27;t reach aisf\.<\/p><button[^>]*>Retry<\/button><\/div>/,
    );
  });

  it('should show no Retry when the poll did not fail', () => {
    expect(render(liveDescription(liveRun))).not.toContain('Retry');
  });

  it('should announce the connection banner between the head and the chat when the connection is lost', () => {
    const markup = render({ ...liveDescription(liveRun), connectionBanner });
    expect(markup).toMatch(
      /<div class="inline-banner" role="status"><span class="shape" aria-hidden="true">▲<\/span><p>Connection lost\. Reconnecting… <span class="sm">What is shown stays\./,
    );
    expect(markup.indexOf('Connection lost')).toBeGreaterThan(markup.indexOf('Stop'));
    expect(markup.indexOf('Connection lost')).toBeLessThan(markup.indexOf('role="log"'));
  });

  it('should show the connection banner with no button and keep the children when the connection is lost', () => {
    const markup = render({ ...liveDescription(liveRun), connectionBanner });
    expect(markup).not.toContain('Retry');
    expect(markup).toMatch(/Connection lost[\s\S]*CONTENT/);
    expect(markup.match(/<button/g)).toHaveLength(1);
  });

  it('should show the connection banner on a Session head when the connection is lost', () => {
    const markup = render({
      label: 'Session',
      rail: 'border-strong',
      head: { kind: 'session' },
      connectionBanner,
    });
    expect(markup).toContain('Connection lost');
  });

  it('should show no connection banner when the connection holds', () => {
    expect(render(liveDescription(liveRun))).not.toContain('Connection lost');
  });

  it('should render a Session head with the time range and no Stop when the session finished', () => {
    const markup = render({
      label: 'Session',
      rail: 'border-strong',
      head: { kind: 'session', timeRange: '14:02 – 14:19' },
    });
    expect(markup).toContain(
      'class="session-panel rail-border-strong" id="ticket-session" aria-label="Session"',
    );
    expect(markup).toContain('Session</span>');
    expect(markup).toContain('14:02 – 14:19');
    expect(markup).not.toContain('Stop');
  });

  it('should render a Session head with no time range when there is none', () => {
    const markup = render({
      label: 'Session',
      rail: 'danger',
      head: { kind: 'session' },
    });
    expect(markup).toContain('rail-danger');
    expect(markup).not.toContain('class="sm"');
  });

  it('should hold its children in a labelled log region after the head', () => {
    const markup = render(liveDescription(liveRun));
    expect(markup).toMatch(
      /<div class="chat" role="log" aria-label="Session"><p>CONTENT<\/p><\/div>/,
    );
  });
});

describe('SessionPanel visibility', () => {
  const description = liveDescription(liveRun);

  function renderHidden(hidden: boolean): string {
    return renderToStaticMarkup(
      <SessionPanel description={description} onStop={ignore} onRetry={ignore} hidden={hidden}>
        <p>CONTENT</p>
      </SessionPanel>,
    );
  }

  it('should carry hidden and stay mounted with its content when hidden', () => {
    const markup = renderHidden(true);

    expect(markup).toMatch(/<section[^>]* hidden=""/);
    expect(markup).toContain('id="ticket-session"');
    expect(markup).toContain('role="log"');
    expect(markup).toContain('CONTENT');
  });

  it('should carry no hidden attribute and keep the id when shown', () => {
    const markup = renderHidden(false);

    expect(markup).not.toMatch(/<section[^>]* hidden/);
    expect(markup).toContain('id="ticket-session"');
  });
});
