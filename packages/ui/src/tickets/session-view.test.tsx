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
  input: { command: 'ls', description: 'List files' },
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

function readCall(id: string, name = 'Read'): SessionEntryResponse {
  return {
    kind: 'tool-call',
    id,
    toolUseId: `use-${id}`,
    name,
    input: { file_path: `${id}.ts` },
  };
}

function textResult(id: string, text: string, isError = false): SessionEntryResponse {
  return {
    kind: 'tool-result',
    id: `r-${id}`,
    toolUseId: `use-${id}`,
    isError,
    parts: [{ kind: 'text', text }],
  };
}

function renderSession(view: SessionView) {
  return renderToStaticMarkup(<SessionViewBody view={view} opened={new Set()} onToggle={ignore} />);
}

function renderEntries(
  entries: ReadonlyArray<SessionEntryResponse>,
  opened: ReadonlySet<string> = new Set(),
  ended = false,
) {
  return renderToStaticMarkup(
    <SessionViewBody
      view={{ kind: 'entries', entries, ended, connectionLost: false }}
      opened={opened}
      onToggle={ignore}
    />,
  );
}

describe('SessionViewBody', () => {
  it('should render a call and its result as one row with a Result toggle', () => {
    const markup = renderEntries([call, result]);
    expect(markup.match(/class="tc-row"/g)).toHaveLength(1);
    expect(markup).toMatch(/>Result <span class="tc-dim">1 line · 1 image<\/span>/);
  });

  it('should render one card with a header and three rows without tags when three Read calls are adjacent', () => {
    const markup = renderEntries(
      ['a', 'b', 'c'].flatMap((id) => [readCall(id), textResult(id, 'x')]),
    );
    expect(markup.match(/class="tc"/g)).toHaveLength(1);
    expect(markup.match(/class="tc-row"/g)).toHaveLength(3);
    expect(markup).toMatch(/class="tc-head">.*>Read<.*>×3<.*>3 done</);
    expect(markup.match(/tc-tag/g)).toHaveLength(1);
  });

  it('should render three cards when Read, Edit and Read follow each other', () => {
    const edit: SessionEntryResponse = readCall('e', 'Edit');
    expect(renderEntries([readCall('a'), edit, readCall('b')]).match(/class="tc"/g)).toHaveLength(
      3,
    );
  });

  it('should render a spinner and only the input toggle when a call has no result in a live run', () => {
    const markup = renderEntries([readCall('a', 'Edit')]);
    expect(markup).toContain('aria-label="Running"');
    expect(markup.match(/<button/g)).toHaveLength(1);
    expect(markup).toContain('>input ');
  });

  it('should render no spinner when the run ended before the call got a result', () => {
    const markup = renderEntries([readCall('a')], new Set(), true);
    expect(markup).not.toContain('aria-label="Running"');
  });

  it('should mark a failed call and style its Error toggle as an error', () => {
    const markup = renderEntries([readCall('a'), textResult('a', 'boom', true)]);
    expect(markup).toMatch(/aria-label="Failed"[^>]*>▲</);
    expect(markup).toMatch(/class="tc-toggle tc-toggle-error"[^>]*>Error /);
  });

  it('should mark a done call with a check', () => {
    expect(renderEntries([readCall('a'), textResult('a', 'x')])).toMatch(
      /aria-label="Done"[^>]*>✓</,
    );
  });

  it('should render the running and failed counts in the group header', () => {
    const edit = (id: string): SessionEntryResponse => readCall(id, 'Edit');
    const markup = renderEntries([edit('a'), textResult('a', 'bad', true), edit('b')]);
    expect(markup).toContain('1 running');
    expect(markup).toMatch(/<span aria-hidden="true">▲<\/span> 1 failed/);
    expect(markup).not.toContain('done<');
  });

  it('should render the description as headline and the command as second line for a Bash call', () => {
    const markup = renderEntries([call]);
    expect(markup).toContain('>List files<');
    expect(markup).toMatch(/class="tc-second"[^>]*>\$ ls</);
  });

  it('should render the size label with a thousands separator', () => {
    const long = Array.from({ length: 2418 }, () => 'x').join('\n');
    expect(renderEntries([readCall('a'), textResult('a', long)])).toContain('2,418 lines');
  });

  it('should not render the result body or the input when both are collapsed', () => {
    const markup = renderEntries([call, result]);
    expect(markup).not.toContain('SECRET-BODY');
    expect(markup).not.toContain('<img');
    expect(markup).not.toContain('&quot;command&quot;');
    expect(markup.match(/aria-expanded="false"/g)).toHaveLength(2);
  });

  it('should open the input pane alone when only its key is opened', () => {
    const markup = renderEntries([call, result], new Set(['c:input']));
    expect(markup).toContain('&quot;command&quot;: &quot;ls&quot;');
    expect(markup).not.toContain('SECRET-BODY');
    expect(markup.match(/aria-expanded="true"/g)).toHaveLength(1);
  });

  it('should open both panes and both toggles independently when both keys are opened', () => {
    const markup = renderEntries([call, result], new Set(['c:input', 'c:result']));
    expect(markup).toContain('SECRET-BODY');
    expect(markup).toContain('src="data:image/png;base64,AAAA"');
    expect(markup).toContain('&quot;command&quot;: &quot;ls&quot;');
    expect(markup.match(/aria-expanded="true"/g)).toHaveLength(2);
  });

  it('should make the open input pane keyboard reachable with a scroll label', () => {
    const markup = renderEntries([call], new Set(['c:input']));
    expect(markup).toMatch(
      /<pre class="tc-pane tc-input" tabindex="0" aria-label="Input, scrolls">/,
    );
  });

  it('should make each open result text pane keyboard reachable with a scroll label', () => {
    const twoTexts: SessionEntryResponse = {
      ...result,
      parts: [
        { kind: 'text', text: 'one' },
        { kind: 'text', text: 'two' },
      ],
    };
    const entries = [call, twoTexts];
    const markup = renderEntries(entries, new Set(['c:result']));
    expect(
      markup.match(/<pre class="tc-pane tc-term" tabindex="0" aria-label="Result text, scrolls">/g),
    ).toHaveLength(2);
  });

  it('should mark the result pane as an error when the result failed', () => {
    const markup = renderEntries(
      [readCall('a'), textResult('a', 'boom', true)],
      new Set(['a:result']),
    );
    expect(markup).toMatch(/<pre class="tc-pane tc-term tc-term-error"[^>]*>boom</);
  });

  it('should not mark the result pane as an error when the result succeeded', () => {
    const markup = renderEntries([readCall('a'), textResult('a', 'fine')], new Set(['a:result']));
    expect(markup).not.toContain('tc-term-error');
  });

  it('should wrap each image part in a frame', () => {
    const markup = renderEntries([call, result], new Set(['c:result']));
    expect(markup).toMatch(
      /<div class="tc-frame"><img class="tc-image" src="data:image\/png;base64,AAAA" alt=""\/><\/div>/,
    );
  });

  it('should render assistant text as markdown and the open block after the entries', () => {
    const markup = renderToStaticMarkup(
      <SessionViewBody
        view={{
          kind: 'entries',
          entries: [{ kind: 'text', id: 'x', text: '**bold**' }],
          openText: 'typing',
          ended: false,
          connectionLost: false,
        }}
        opened={new Set()}
        onToggle={ignore}
      />,
    );
    expect(markup).toContain('<strong>bold</strong>');
    expect(markup.indexOf('typing')).toBeGreaterThan(markup.indexOf('bold'));
  });

  it('should render a prompt as markdown under an App label', () => {
    const markup = renderSession({
      kind: 'entries',
      entries: [{ kind: 'prompt', id: 'p', text: '### Ticket\n\nBuild it.\n\n- one\n- `two`' }],
      ended: false,
      connectionLost: false,
    });
    expect(markup).toContain('sv-prompt');
    expect(markup).toContain('>App</');
    expect(markup).toContain('>Ticket</h3>');
    expect(markup).toContain('<li>one</li>');
    expect(markup).toContain('<code>two</code>');
  });

  it('should render text as a bubble inside the turn column', () => {
    const markup = renderSession({
      kind: 'entries',
      entries: [{ kind: 'text', id: 'x', text: 'hello' }],
      ended: false,
      connectionLost: false,
    });
    expect(markup).toMatch(/class="sv-turn"[^>]*><div class="sv-bubble"/);
  });

  it('should render two turn columns when a second prompt follows text', () => {
    const markup = renderSession({
      kind: 'entries',
      entries: [
        { kind: 'prompt', id: 'p1', text: 'One' },
        { kind: 'text', id: 't1', text: 'a' },
        { kind: 'text', id: 't2', text: 'b' },
        { kind: 'prompt', id: 'p2', text: 'Two' },
        { kind: 'text', id: 't3', text: 'c' },
      ],
      ended: false,
      connectionLost: false,
    });
    expect(markup.match(/class="sv-turn"/g)).toHaveLength(2);
    expect(markup.match(/class="sv-prompt"/g)).toHaveLength(2);
  });

  it('should render the open block with a caret hidden from readers', () => {
    const markup = renderSession({
      kind: 'entries',
      entries: [],
      openText: 'Hel',
      ended: false,
      connectionLost: false,
    });
    expect(markup).toMatch(/Hel<span class="sv-caret" aria-hidden="true">/);
  });

  it('should render no caret when the block has closed into an entry', () => {
    const markup = renderSession({
      kind: 'entries',
      entries: [{ kind: 'text', id: 'x', text: 'Hello' }],
      ended: false,
      connectionLost: false,
    });
    expect(markup).toContain('Hello');
    expect(markup).not.toContain('sv-caret');
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
    const markup = renderSession({
      kind: 'entries',
      entries: [call],
      ended: true,
      connectionLost: false,
    });
    expect(markup.indexOf('End of session')).toBeGreaterThan(markup.indexOf('Bash'));
  });

  it('should render no end line while the session is live', () => {
    expect(
      renderSession({ kind: 'entries', entries: [call], ended: false, connectionLost: false }),
    ).not.toContain('End of session');
  });
});

describe('SessionViewBody titles', () => {
  it('should show titles and no input button when rows are Read and Skill', () => {
    const view: SessionView = {
      kind: 'entries',
      root: '/w/repo/7',
      entries: [
        {
          kind: 'tool-call',
          id: 'a',
          toolUseId: 'ua',
          name: 'Read',
          input: { file_path: '/w/repo/7/a.ts' },
        },
        {
          kind: 'tool-call',
          id: 'b',
          toolUseId: 'ub',
          name: 'Skill',
          input: { skill: 'aisf:tdd' },
        },
      ],
      ended: false,
      connectionLost: false,
    };
    const markup = renderToStaticMarkup(
      <SessionViewBody view={view} opened={new Set()} onToggle={ignore} />,
    );
    expect(markup).toContain('>a.ts<');
    expect(markup).toContain('>aisf:tdd<');
    expect(markup).not.toContain('>input ');
  });
  describe('handback', () => {
    const entries: ReadonlyArray<SessionEntryResponse> = [
      { kind: 'handback', id: 'h1', agentId: null, text: 'Full report' },
    ];

    it('should show only the header when the handback is not opened', () => {
      const html = renderEntries(entries);
      expect(html).toContain('Subagent response');
      expect(html).not.toContain('Full report');
    });

    it('should show the report when the handback id is opened', () => {
      expect(renderEntries(entries, new Set(['h1']))).toContain('Full report');
    });

    it('should show the header alone in the label and the chevron apart when collapsed', () => {
      const html = renderEntries(entries);
      expect(html).toContain('<span class="hb-label">Subagent response</span>');
      expect(html).toContain('<span class="hb-chev" aria-hidden="true">▸</span>');
      expect(html).toContain('aria-expanded="false"');
    });

    it('should turn the chevron and expose a labelled scrollable body when opened', () => {
      const html = renderEntries(entries, new Set(['h1']));
      expect(html).toContain('<span class="hb-chev" aria-hidden="true">▾</span>');
      expect(html).toContain('aria-expanded="true"');
      expect(html).toContain('tabindex="0"');
      expect(html).toContain('aria-label="Subagent response, scrolls"');
    });
  });
});
