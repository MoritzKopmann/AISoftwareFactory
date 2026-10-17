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
  it('should list the entries in order and add the open block last when text is streaming', () => {
    const prompt: SessionEntryResponse = { kind: 'prompt', id: 'p', text: 'Go' };
    expect(
      describeSessionView({ kind: 'entries', entries: [prompt], openText: 'Hel', ended: false }),
    ).toEqual({ kind: 'entries', entries: [prompt], openText: 'Hel', ended: false });
  });

  it('should carry the ended flag so the end line can be drawn', () => {
    const prompt: SessionEntryResponse = { kind: 'prompt', id: 'p', text: 'Go' };
    expect(describeSessionView({ kind: 'entries', entries: [prompt], ended: true })).toEqual({
      kind: 'entries',
      entries: [prompt],
      ended: true,
    });
  });

  it('should give a system line when there are no entries and no open text', () => {
    const shown = describeSessionView({ kind: 'entries', entries: [], ended: false });
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

  it('should pass a prompt and a text entry through', () => {
    expect(describeSessionEntry({ kind: 'prompt', id: 'p', text: 'Go' }, false)).toEqual({
      kind: 'prompt',
      text: 'Go',
    });
    expect(describeSessionEntry({ kind: 'text', id: 'x', text: 'Hi' }, false)).toEqual({
      kind: 'text',
      text: 'Hi',
    });
  });
});
