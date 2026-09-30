import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RunBar } from '../../src/tickets/run-bar.js';

const ignoreRun = () => undefined;

describe('RunBar', () => {
  it('should render nothing when the bar is hidden', () => {
    expect(
      renderToStaticMarkup(<RunBar description={{ kind: 'hidden' }} onRun={ignoreRun} />),
    ).toBe('');
  });

  it('should render the hint without linking it to the button when the run is available', () => {
    const markup = renderToStaticMarkup(
      <RunBar
        description={{ kind: 'shown', button: 'run', pressable: true, hint: 'Runs it.' }}
        onRun={ignoreRun}
      />,
    );
    expect(markup).toContain('Runs it.');
    expect(markup).not.toContain('aria-describedby');
    expect(markup).not.toContain('aria-disabled');
  });

  it('should keep the disabled button focusable and link it to the visible reason when the run is disabled', () => {
    const markup = renderToStaticMarkup(
      <RunBar
        description={{ kind: 'shown', button: 'disabled', pressable: false, reason: 'Busy.' }}
        onRun={ignoreRun}
      />,
    );
    const describedBy = /aria-describedby="([^"]+)"/.exec(markup)?.[1];
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).not.toMatch(/\sdisabled=""/);
    expect(describedBy).toBeDefined();
    expect(markup).toContain(`id="${describedBy}">Busy.<`);
  });

  it('should announce the start through a status region when a start is pending', () => {
    const markup = renderToStaticMarkup(
      <RunBar
        description={{
          kind: 'shown',
          button: 'starting',
          pressable: false,
          announcement: 'Starting the run',
        }}
        onRun={ignoreRun}
      />,
    );
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).toContain('Starting…');
    expect(markup).toMatch(/role="status"[^>]*>Starting the run</);
  });

  it('should announce a failed start through an alert with the message and the status', () => {
    const markup = renderToStaticMarkup(
      <RunBar
        description={{
          kind: 'shown',
          button: 'run',
          pressable: true,
          error: { message: 'Couldn’t start the run. Busy.', detail: '409' },
        }}
        onRun={ignoreRun}
      />,
    );
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('Couldn’t start the run. Busy.');
    expect(markup).toContain('>409<');
  });
});
