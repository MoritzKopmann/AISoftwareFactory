import type { SessionEntryResponse } from '@aisf/app/api-schemas/session-stream-schemas.js';
import { describe, expect, it } from 'vitest';
import { describeSessionView } from './describe-session-view.js';

type Text = Extract<SessionEntryResponse, { kind: 'text' }>;
type Call = Extract<SessionEntryResponse, { kind: 'tool-call' }>;
type Result = Extract<SessionEntryResponse, { kind: 'tool-result' }>;

const textItem = (entry: Text) => ({ kind: 'text', entry });
const call = (id: string, name: string): Call => ({
  kind: 'tool-call',
  id,
  toolUseId: `use-${id}`,
  name,
  input: {},
});
const resultOf = (id: string): Result => ({
  kind: 'tool-result',
  id: `r-${id}`,
  toolUseId: `use-${id}`,
  isError: false,
  parts: [],
});
const text = (id: string): Text => ({ kind: 'text', id, text: id });

function cardsOf(entries: ReadonlyArray<SessionEntryResponse>) {
  const shown = describeSessionView({
    kind: 'entries',
    entries,
    ended: false,
    connectionLost: false,
  });
  if (shown.kind !== 'entries') throw new Error('expected entries');
  return shown.turns
    .flatMap((turn) => turn.items)
    .map((item) =>
      item.kind === 'tool-card' ? `${item.card.name}×${item.card.calls.length}` : item.kind,
    );
}

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
      turns: [{ id: 'p', prompt, items: [], openText: 'Hel' }],
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
      turns: [{ id: 'p', prompt, items: [] }],
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
        { id: 'p1', prompt: p1, items: [textItem(t1), textItem(t2)] },
        { id: 'p2', prompt: p2, items: [textItem(t3)] },
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
      turns: [{ id: 'start', items: [textItem(t1)], openText: 'x' }],
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

  it('should hold a call and its result in one row when the toolUseId matches', () => {
    const c = call('c', 'Read');
    const r = resultOf('c');
    const shown = describeSessionView({
      kind: 'entries',
      entries: [c, r],
      ended: false,
      connectionLost: false,
    });
    expect(shown).toMatchObject({
      turns: [
        { items: [{ kind: 'tool-card', card: { id: 'c', calls: [{ call: c, result: r }] } }] },
      ],
    });
  });

  it('should leave the result out of the row when the call has no result yet', () => {
    const c = call('c', 'Read');
    const shown = describeSessionView({
      kind: 'entries',
      entries: [c],
      ended: false,
      connectionLost: false,
    });
    expect(shown).toMatchObject({ turns: [{ items: [{ card: { calls: [{ call: c }] } }] }] });
    expect(JSON.stringify(shown)).not.toContain('"result"');
  });

  it('should join adjacent calls of one tool into one card when results sit between them', () => {
    expect(
      cardsOf([
        call('a', 'Read'),
        resultOf('a'),
        call('b', 'Read'),
        call('c', 'Read'),
        resultOf('c'),
        resultOf('b'),
      ]),
    ).toEqual(['Read×3']);
  });

  it('should start a new card when the tool changes', () => {
    expect(cardsOf([call('a', 'Read'), call('b', 'Edit'), call('c', 'Read')])).toEqual([
      'Read×1',
      'Edit×1',
      'Read×1',
    ]);
  });

  it('should end the group when a text entry comes between two calls of one tool', () => {
    expect(cardsOf([call('a', 'Read'), text('t'), call('b', 'Read')])).toEqual([
      'Read×1',
      'text',
      'Read×1',
    ]);
  });

  it('should end the group when a prompt comes between two calls of one tool', () => {
    expect(
      cardsOf([call('a', 'Read'), { kind: 'prompt', id: 'p', text: 'Go' }, call('b', 'Read')]),
    ).toEqual(['Read×1', 'Read×1']);
  });

  it('should leave out a result whose call is unknown', () => {
    expect(cardsOf([resultOf('missing')])).toEqual([]);
  });
});

type Handback = Extract<SessionEntryResponse, { kind: 'handback' }>;

const agentCall = (name = 'Agent'): Call => ({
  kind: 'tool-call',
  id: 'c1',
  toolUseId: 't1',
  name,
  input: { description: 'Scan transcripts' },
});
const taggedResult = (agentId: string): Result => ({
  kind: 'tool-result',
  id: 'r1',
  toolUseId: 't1',
  isError: false,
  parts: [],
  agentId,
});
const handback = (id: string, agentId: string | null): Handback => ({
  kind: 'handback',
  id,
  agentId,
  text: `report ${id}`,
});

function turnsOf(entries: ReadonlyArray<SessionEntryResponse>) {
  const shown = describeSessionView({
    kind: 'entries',
    entries,
    ended: false,
    connectionLost: false,
  });
  if (shown.kind !== 'entries') throw new Error('expected entries');
  return shown.turns;
}

function handbackHeaders(entries: ReadonlyArray<SessionEntryResponse>) {
  return turnsOf(entries)
    .flatMap((turn) => turn.items)
    .flatMap((item) => (item.kind === 'handback' ? [item.header] : []));
}

describe('describeSessionView handbacks', () => {
  it('should use the call description when the handback matches an Agent call', () => {
    expect(handbackHeaders([agentCall(), taggedResult('a1'), handback('h', 'a1')])).toEqual([
      'Scan transcripts response',
    ]);
  });

  it('should use the generic header when no result carries the agentId', () => {
    expect(handbackHeaders([handback('h', 'a9')])).toEqual(['Subagent response']);
  });

  it('should use the generic header when the handback has no agentId', () => {
    expect(handbackHeaders([handback('h', null)])).toEqual(['Subagent response']);
  });

  it('should use the generic header when the tagged call is not Agent or Task', () => {
    expect(handbackHeaders([agentCall('Bash'), taggedResult('a1'), handback('h', 'a1')])).toEqual([
      'Subagent response',
    ]);
  });

  it('should join a Task call', () => {
    expect(handbackHeaders([agentCall('Task'), taggedResult('a1'), handback('h', 'a1')])).toEqual([
      'Scan transcripts response',
    ]);
  });

  it('should use the generic header when the call has no string description', () => {
    const noDescription: Call = { ...agentCall(), input: {} };
    expect(handbackHeaders([noDescription, taggedResult('a1'), handback('h', 'a1')])).toEqual([
      'Subagent response',
    ]);
  });

  it('should join when the tagged result comes after the handback', () => {
    expect(handbackHeaders([agentCall(), handback('h', 'a1'), taggedResult('a1')])).toEqual([
      'Scan transcripts response',
    ]);
  });

  it('should give each handback its own item when one subagent hands back twice', () => {
    expect(
      handbackHeaders([
        agentCall(),
        taggedResult('a1'),
        handback('h1', 'a1'),
        handback('h2', 'a1'),
      ]),
    ).toEqual(['Scan transcripts response', 'Scan transcripts response']);
  });

  it('should keep a handback in the turn after the text when it follows a prompt', () => {
    const turns = turnsOf([
      { kind: 'prompt', id: 'p', text: 'Go' },
      text('t'),
      handback('h', null),
    ]);
    expect(turns).toHaveLength(1);
    expect(turns[0]?.items.map((item) => item.kind)).toEqual(['text', 'handback']);
  });
});
