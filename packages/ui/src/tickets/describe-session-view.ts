import type { SessionEntryResponse } from '@aisf/app/api-schemas/session-stream-schemas.js';
import type { ToolCallEntry, ToolCardEntries, ToolResultEntry } from './describe-tool-card.js';
import type { SessionView } from './fold-session-view.js';

export type SessionViewDescription =
  | { readonly kind: 'loading'; readonly caption: string }
  | { readonly kind: 'system-line'; readonly message: string }
  | {
      readonly kind: 'transcript-not-found';
      readonly title: string;
      readonly detail: string;
    }
  | {
      readonly kind: 'entries';
      readonly turns: ReadonlyArray<SessionTurnDescription>;
      readonly ended: boolean;
    };

type PromptEntry = Extract<SessionEntryResponse, { kind: 'prompt' }>;
type TextEntry = Extract<SessionEntryResponse, { kind: 'text' }>;

export type TurnItem =
  | { readonly kind: 'text'; readonly entry: TextEntry }
  | { readonly kind: 'tool-card'; readonly card: ToolCardEntries };

/** A prompt and what follows it, up to the next prompt. */
export type SessionTurnDescription = {
  readonly id: string;
  readonly prompt?: PromptEntry;
  readonly items: ReadonlyArray<TurnItem>;
  /** Only the last turn can hold the block being written. */
  readonly openText?: string;
};

export function describeSessionView(view: SessionView): SessionViewDescription {
  switch (view.kind) {
    case 'waiting':
      return { kind: 'loading', caption: 'Connecting to session…' };
    case 'no-session':
      return { kind: 'system-line', message: 'This ticket has no run with a session' };
    case 'transcript-not-found':
      return {
        kind: 'transcript-not-found',
        title: 'Transcript not found',
        detail: 'The run ended, but its transcript is missing. There is nothing to show.',
      };
    case 'entries':
      if (hasNothingToShow(view)) {
        return { kind: 'system-line', message: 'No entries yet.' };
      }
      return {
        kind: 'entries',
        turns: groupIntoTurns(view.entries, view.openText),
        ended: view.ended,
      };
  }
}

type MutableCard = { id: string; name: string; calls: ToolCardEntries['calls'][number][] };
type MutableTurnItem =
  { kind: 'text'; entry: TextEntry } | { kind: 'tool-card'; card: MutableCard };
type MutableTurn = { id: string; prompt?: PromptEntry; items: MutableTurnItem[] };

function groupIntoTurns(
  entries: ReadonlyArray<SessionEntryResponse>,
  openText: string | undefined,
): ReadonlyArray<SessionTurnDescription> {
  const results = new Map<string, ToolResultEntry>();
  for (const entry of entries) {
    if (entry.kind === 'tool-result') results.set(entry.toolUseId, entry);
  }
  const turns: MutableTurn[] = [];
  const currentTurn = (): MutableTurn => {
    let turn = turns[turns.length - 1];
    if (turn === undefined) {
      turn = { id: 'start', items: [] };
      turns.push(turn);
    }
    return turn;
  };
  for (const entry of entries) {
    switch (entry.kind) {
      case 'prompt':
        turns.push({ id: entry.id, prompt: entry, items: [] });
        break;
      case 'text':
        currentTurn().items.push({ kind: 'text', entry });
        break;
      case 'tool-call':
        addCall(currentTurn().items, entry, results.get(entry.toolUseId));
        break;
      case 'tool-result':
        break;
    }
  }
  if (openText === undefined) return turns;
  currentTurn();
  return turns.map((turn, position) =>
    position === turns.length - 1 ? { ...turn, openText } : turn,
  );
}

/** Adjacent calls of one tool share a card; a result never ends the group. */
function addCall(
  items: MutableTurnItem[],
  call: ToolCallEntry,
  result: ToolResultEntry | undefined,
) {
  const entry = { call, ...(result !== undefined && { result }) };
  const last = items[items.length - 1];
  if (last?.kind === 'tool-card' && last.card.name === call.name) {
    last.card.calls.push(entry);
    return;
  }
  items.push({ kind: 'tool-card', card: { id: call.id, name: call.name, calls: [entry] } });
}

function hasNothingToShow(view: { entries: ReadonlyArray<unknown>; openText?: string }): boolean {
  return view.entries.length === 0 && view.openText === undefined;
}
