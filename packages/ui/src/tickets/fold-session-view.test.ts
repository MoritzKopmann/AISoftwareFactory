import type { SessionEntryResponse } from '@aisf/app/api-schemas/session-stream-schemas.js';
import { describe, expect, it } from 'vitest';
import { foldSessionView, initialSessionView, markConnectionLost } from './fold-session-view.js';

const prompt: SessionEntryResponse = { kind: 'prompt', id: 'e1', text: 'Do it' };
const text: SessionEntryResponse = { kind: 'text', id: 'e2', text: 'Hello world' };
const call: SessionEntryResponse = {
  kind: 'tool-call',
  id: 'e3',
  toolUseId: 't1',
  name: 'Bash',
  input: { command: 'ls' },
};
const result: SessionEntryResponse = {
  kind: 'tool-result',
  id: 'e4',
  toolUseId: 't1',
  isError: false,
  parts: [{ kind: 'text', text: 'a.txt' }],
};

describe('foldSessionView', () => {
  it('should keep the snapshot root when an entry follows', () => {
    const snapshot = foldSessionView(initialSessionView, {
      kind: 'snapshot',
      entries: [prompt],
      root: '/w/repo/7',
    });
    const view = foldSessionView(snapshot, { kind: 'entry', entry: text });
    expect(view).toMatchObject({ kind: 'entries', root: '/w/repo/7' });
  });

  it('should hold the snapshot entries in order when a snapshot arrives', () => {
    const view = foldSessionView(initialSessionView, {
      kind: 'snapshot',
      entries: [prompt, text, call, result],
      root: '/w/repo/7',
    });
    expect(view).toMatchObject({ kind: 'entries', entries: [prompt, text, call, result] });
  });

  it('should show an open block with the joined words when an opening delta and a following delta arrive', () => {
    const opened = foldSessionView(initialSessionView, {
      kind: 'delta',
      opensBlock: true,
      text: 'Hel',
    });
    const view = foldSessionView(opened, { kind: 'delta', opensBlock: false, text: 'lo' });
    expect(view).toMatchObject({ kind: 'entries', openText: 'Hello' });
  });

  it('should replace the open block with the entry when an entry arrives', () => {
    const opened = foldSessionView(initialSessionView, {
      kind: 'delta',
      opensBlock: true,
      text: 'Hel',
    });
    const view = foldSessionView(opened, { kind: 'entry', entry: text });
    expect(view).toMatchObject({ entries: [text] });
    expect('openText' in view && view.openText).toBeFalsy();
  });

  it('should show no partial text and the whole entry when the view joined mid-block', () => {
    const joined = foldSessionView(initialSessionView, {
      kind: 'snapshot',
      entries: [prompt],
      root: '/w/repo/7',
    });
    const mid = foldSessionView(joined, { kind: 'delta', opensBlock: false, text: 'world' });
    expect('openText' in mid && mid.openText).toBeFalsy();
    const view = foldSessionView(mid, { kind: 'entry', entry: text });
    expect(view).toMatchObject({ entries: [prompt, text] });
    expect('openText' in view && view.openText).toBeFalsy();
  });

  it('should keep the entries and mark the end when the stream ends', () => {
    const joined = foldSessionView(initialSessionView, {
      kind: 'snapshot',
      entries: [prompt],
      root: '/w/repo/7',
    });
    expect(foldSessionView(joined, { kind: 'ended' })).toMatchObject({
      kind: 'entries',
      entries: [prompt],
      ended: true,
    });
  });

  it('should show the matching empty state when no-session or transcript-not-found arrives', () => {
    expect(foldSessionView(initialSessionView, { kind: 'no-session' })).toEqual({
      kind: 'no-session',
    });
    expect(foldSessionView(initialSessionView, { kind: 'transcript-not-found' })).toEqual({
      kind: 'transcript-not-found',
    });
  });

  it('should drop the open block and the end mark when a new snapshot arrives', () => {
    const open = foldSessionView(initialSessionView, {
      kind: 'delta',
      opensBlock: true,
      text: 'x',
    });
    const ended = foldSessionView(open, { kind: 'ended' });
    const view = foldSessionView(ended, { kind: 'snapshot', entries: [prompt], root: '/w/repo/7' });
    expect(view).toEqual({
      kind: 'entries',
      entries: [prompt],
      root: '/w/repo/7',
      ended: false,
      connectionLost: false,
    });
  });

  describe('label frames', () => {
    const snapshot = foldSessionView(initialSessionView, {
      kind: 'snapshot',
      entries: [prompt, call, result],
      root: '/w/repo/7',
    });

    it('should set the label on that tool call and leave other entries when a label frame arrives', () => {
      const view = foldSessionView(snapshot, {
        kind: 'label',
        toolUseId: 't1',
        label: 'Runs the tests.',
      });
      expect(view).toMatchObject({
        kind: 'entries',
        entries: [prompt, { ...call, label: 'Runs the tests.' }, result],
      });
    });

    it('should return the same view when the label is for an unknown call', () => {
      expect(foldSessionView(snapshot, { kind: 'label', toolUseId: 't9', label: 'x' })).toBe(
        snapshot,
      );
    });
  });

  describe('markConnectionLost', () => {
    it('should return the same object when the view is already lost', () => {
      const lost = markConnectionLost(
        foldSessionView(initialSessionView, {
          kind: 'snapshot',
          entries: [prompt],
          root: '/w/repo/7',
        }),
      );
      expect(lost).toMatchObject({ kind: 'entries', connectionLost: true, entries: [prompt] });
      expect(markConnectionLost(lost)).toBe(lost);
    });

    it('should return the same object when the view is not entries', () => {
      expect(markConnectionLost(initialSessionView)).toBe(initialSessionView);
    });

    it('should clear the flag when a snapshot follows', () => {
      const lost = markConnectionLost(
        foldSessionView(initialSessionView, {
          kind: 'snapshot',
          entries: [prompt],
          root: '/w/repo/7',
        }),
      );
      expect(
        foldSessionView(lost, { kind: 'snapshot', entries: [text], root: '/w/repo/7' }),
      ).toMatchObject({
        entries: [text],
        connectionLost: false,
      });
    });

    it('should keep the flag when an entry, delta or ended frame follows', () => {
      const lost = markConnectionLost(
        foldSessionView(initialSessionView, {
          kind: 'snapshot',
          entries: [prompt],
          root: '/w/repo/7',
        }),
      );
      const withEntry = foldSessionView(lost, { kind: 'entry', entry: text });
      const withDelta = foldSessionView(withEntry, { kind: 'delta', opensBlock: true, text: 'x' });
      const ended = foldSessionView(withDelta, { kind: 'ended' });
      expect([withEntry, withDelta, ended]).toMatchObject([
        { connectionLost: true },
        { connectionLost: true },
        { connectionLost: true },
      ]);
    });
  });
});
