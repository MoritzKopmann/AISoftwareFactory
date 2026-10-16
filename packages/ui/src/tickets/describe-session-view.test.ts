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
    ).toEqual({ kind: 'entries', entries: [prompt], openText: 'Hel' });
  });

  it('should omit the open text when no block is streaming', () => {
    const shown = describeSessionView({ kind: 'entries', entries: [], ended: false });
    expect(shown).toEqual({ kind: 'message', message: 'No entries yet.' });
  });

  it('should give a message for each empty state', () => {
    expect(describeSessionView({ kind: 'no-session' })).toEqual({
      kind: 'message',
      message: 'No session yet. A run on this ticket starts one.',
    });
    expect(describeSessionView({ kind: 'transcript-not-found' })).toEqual({
      kind: 'message',
      message: "Transcript not found. Claude Code has removed this session's transcript.",
    });
  });

  it('should give a loading message when nothing has arrived', () => {
    expect(describeSessionView({ kind: 'waiting' })).toEqual({
      kind: 'message',
      message: 'Loading the session…',
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
