import type { SessionEntryResponse } from '@aisf/app/api-schemas/session-stream-schemas.js';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { SessionView } from './fold-session-view.js';
import { SessionViewBody } from './session-view.js';

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

function renderSession(view: SessionView) {
  return renderToStaticMarkup(<SessionViewBody view={view} opened={new Set()} onToggle={ignore} />);
}

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

  it('should render the pulsing caption before any frame arrives', () => {
    const markup = renderSession({ kind: 'waiting' });
    expect(markup).toContain('Connecting to session…');
    expect(markup).toContain('pulse');
  });

  it('should render a system line when the session is missing', () => {
    const markup = renderSession({ kind: 'no-session' });
    expect(markup).toContain('This ticket has no run with a session');
    expect(markup).toContain('role="status"');
  });

  it('should render both lines, the mark hidden from readers, when the transcript is missing', () => {
    const markup = renderSession({ kind: 'transcript-not-found' });
    expect(markup).toContain('<span aria-hidden="true">▲ </span>Transcript not found');
    expect(markup).toContain('The run ended, but its transcript is missing.');
    expect(markup).toContain('role="status"');
  });

  it('should render the end line after the last entry when the session ended', () => {
    const markup = renderSession({ kind: 'entries', entries: [call], ended: true });
    expect(markup.indexOf('End of session')).toBeGreaterThan(markup.indexOf('Bash'));
  });

  it('should render no end line while the session is live', () => {
    expect(renderSession({ kind: 'entries', entries: [call], ended: false })).not.toContain(
      'End of session',
    );
  });
});
