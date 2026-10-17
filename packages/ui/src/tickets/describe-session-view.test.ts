import type { SessionEntryResponse } from '@aisf/app/api-schemas/session-stream-schemas.js';
import { describe, expect, it } from 'vitest';
import { describeSessionEntry, describeSessionView } from './describe-session-view.js';

const result: SessionEntryResponse = {
  kind: 'tool-result',
  id: 'r1',
  toolUseId: 't1',
  isError: false,
  parts: [
    { kind: 'text', text: 'big output' },
    { kind: 'image', mediaType: 'image/png', data: 'AAAA' },
  ],
};

describe('describeSessionView', () => {
  it('should put the open block into the last turn when text is streaming', () => {
    const prompt: SessionEntryResponse = { kind: 'prompt', id: 'p', text: 'Go' };
    expect(
      describeSessionView({
        kind: 'entries',
        entries: [prompt],
        openText: 'Hel',
        ended: false,
        connectionLost: false,
      }),
    ).toEqual({
      kind: 'entries',
      turns: [{ id: 'p', prompt, entries: [], openText: 'Hel' }],
      ended: false,
    });
  });

  it('should carry the ended flag so the end line can be drawn', () => {
    const prompt: SessionEntryResponse = { kind: 'prompt', id: 'p', text: 'Go' };
    expect(
      describeSessionView({
        kind: 'entries',
        entries: [prompt],
        ended: true,
        connectionLost: false,
      }),
    ).toEqual({
      kind: 'entries',
      turns: [{ id: 'p', prompt, entries: [] }],
      ended: true,
    });
  });

  it('should group the entries after each prompt into one turn when there are two prompts', () => {
    const p1: SessionEntryResponse = { kind: 'prompt', id: 'p1', text: 'One' };
    const t1: SessionEntryResponse = { kind: 'text', id: 't1', text: 'a' };
    const t2: SessionEntryResponse = { kind: 'text', id: 't2', text: 'b' };
    const p2: SessionEntryResponse = { kind: 'prompt', id: 'p2', text: 'Two' };
    const t3: SessionEntryResponse = { kind: 'text', id: 't3', text: 'c' };
    expect(
      describeSessionView({
        kind: 'entries',
        entries: [p1, t1, t2, p2, t3],
        ended: false,
        connectionLost: false,
      }),
    ).toEqual({
      kind: 'entries',
      turns: [
        { id: 'p1', prompt: p1, entries: [t1, t2] },
        { id: 'p2', prompt: p2, entries: [t3] },
      ],
      ended: false,
    });
  });

  it('should open a turn without a prompt when entries come before any prompt', () => {
    const t1: SessionEntryResponse = { kind: 'text', id: 't1', text: 'a' };
    expect(
      describeSessionView({
        kind: 'entries',
        entries: [t1],
        openText: 'x',
        ended: false,
        connectionLost: false,
      }),
    ).toEqual({
      kind: 'entries',
      turns: [{ id: 'start', entries: [t1], openText: 'x' }],
      ended: false,
    });
  });

  it('should give a system line when there are no entries and no open text', () => {
    const shown = describeSessionView({
      kind: 'entries',
      entries: [],
      ended: false,
      connectionLost: false,
    });
    expect(shown).toEqual({ kind: 'system-line', message: 'No entries yet.' });
  });

  it('should give a system line when the ticket has no session', () => {
    expect(describeSessionView({ kind: 'no-session' })).toEqual({
      kind: 'system-line',
      message: 'This ticket has no run with a session',
    });
  });

  it('should give two lines when the transcript is missing', () => {
    expect(describeSessionView({ kind: 'transcript-not-found' })).toEqual({
      kind: 'transcript-not-found',
      title: 'Transcript not found',
      detail: 'The run ended, but its transcript is missing. There is nothing to show.',
    });
  });

  it('should give a loading caption when nothing has arrived', () => {
    expect(describeSessionView({ kind: 'waiting' })).toEqual({
      kind: 'loading',
      caption: 'Connecting to session…',
    });
  });
});

describe('describeSessionEntry', () => {
  it('should show a tool call with its full input as formatted json', () => {
    expect(
      describeSessionEntry(
        { kind: 'tool-call', id: 'c', toolUseId: 't', name: 'Bash', input: { command: 'ls' } },
        false,
      ),
    ).toEqual({
      kind: 'tool-call',
      name: 'Bash',
      input: JSON.stringify({ command: 'ls' }, null, 2),
    });
  });

  it('should hold no body for a collapsed tool result', () => {
    expect(describeSessionEntry(result, false)).toEqual({
      kind: 'tool-result',
      label: 'Result',
      open: false,
    });
  });

  it('should hold the text and the image source for an opened tool result', () => {
    expect(describeSessionEntry(result, true)).toEqual({
      kind: 'tool-result',
      label: 'Result',
      open: true,
      parts: [
        { kind: 'text', text: 'big output' },
        { kind: 'image', src: 'data:image/png;base64,AAAA' },
      ],
    });
  });

  it('should label an error result and drop an image whose media type is not an image', () => {
    const bad: SessionEntryResponse = {
      kind: 'tool-result',
      id: 'r2',
      toolUseId: 't',
      isError: true,
      parts: [{ kind: 'image', mediaType: 'text/html', data: 'x' }],
    };
    expect(describeSessionEntry(bad, true)).toEqual({
      kind: 'tool-result',
      label: 'Result (error)',
      open: true,
      parts: [],
    });
  });

  it('should pass a text entry through', () => {
    expect(describeSessionEntry({ kind: 'text', id: 'x', text: 'Hi' }, false)).toEqual({
      kind: 'text',
      text: 'Hi',
    });
  });
});
