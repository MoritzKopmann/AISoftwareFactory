import type { SessionEntryResponse } from '@aisf/app/api-schemas/session-stream-schemas.js';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { LiveUpdates } from '../live/live-updates.js';
import { LiveSession, SessionViewBody } from './session-view.js';

const ignore = () => undefined;

const call: SessionEntryResponse = {
  kind: 'tool-call',
  id: 'c',
  toolUseId: 't',
  name: 'Bash',
  input: { command: 'ls' },
};
const result: SessionEntryResponse = {
  kind: 'tool-result',
  id: 'r',
  toolUseId: 't',
  isError: false,
  parts: [
    { kind: 'text', text: 'SECRET-BODY' },
    { kind: 'image', mediaType: 'image/png', data: 'AAAA' },
  ],
};

function render(opened: ReadonlySet<string>) {
  return renderToStaticMarkup(
    <SessionViewBody
      view={{ kind: 'entries', entries: [call, result], ended: false }}
      opened={opened}
      onToggle={ignore}
    />,
  );
}

describe('SessionViewBody', () => {
  it('should not render the result body when the result is collapsed', () => {
    const markup = render(new Set());
    expect(markup).not.toContain('SECRET-BODY');
    expect(markup).not.toContain('<img');
    expect(markup).toContain('aria-expanded="false"');
  });

  it('should render the result text and image when the result is opened', () => {
    const markup = render(new Set(['r']));
    expect(markup).toContain('SECRET-BODY');
    expect(markup).toContain('src="data:image/png;base64,AAAA"');
    expect(markup).toContain('aria-expanded="true"');
  });

  it('should render the tool call name and full input', () => {
    expect(render(new Set())).toMatch(/Bash/);
    expect(render(new Set())).toContain('&quot;command&quot;: &quot;ls&quot;');
  });

  it('should render assistant text as markdown and the open block after the entries', () => {
    const markup = renderToStaticMarkup(
      <SessionViewBody
        view={{
          kind: 'entries',
          entries: [{ kind: 'text', id: 'x', text: '**bold**' }],
          openText: 'typing',
          ended: false,
        }}
        opened={new Set()}
        onToggle={ignore}
      />,
    );
    expect(markup).toContain('<strong>bold</strong>');
    expect(markup.indexOf('typing')).toBeGreaterThan(markup.indexOf('bold'));
  });

  it('should render the message when the session is missing', () => {
    const markup = renderToStaticMarkup(
      <SessionViewBody view={{ kind: 'no-session' }} opened={new Set()} onToggle={ignore} />,
    );
    expect(markup).toContain('No session yet.');
  });
});

describe('LiveSession', () => {
  it('should render the loading message before any frame arrives', () => {
    const liveUpdates: LiveUpdates = { listen: () => ignore, connection: () => 'open' };
    const markup = renderToStaticMarkup(
      <LiveSession liveUpdates={liveUpdates} projectId="o/n" number={7} />,
    );
    expect(markup).toContain('Loading the session…');
  });
});
