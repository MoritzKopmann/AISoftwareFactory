import type { SessionEntryResponse } from '@aisf/app/api-schemas/session-stream-schemas.js';
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
type AgentEntry = Exclude<SessionEntryResponse, { kind: 'prompt' }>;

/** A prompt and the entries after it, up to the next prompt. */
export type SessionTurnDescription = {
  readonly id: string;
  readonly prompt?: PromptEntry;
  readonly entries: ReadonlyArray<AgentEntry>;
  /** Only the last turn can hold the block being written. */
  readonly openText?: string;
};

export type ResultPartDescription =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'image'; readonly src: string };

export type SessionEntryDescription =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'tool-call'; readonly name: string; readonly input: string }
  | {
      readonly kind: 'tool-result';
      readonly label: string;
      readonly open: boolean;
      readonly parts?: ReadonlyArray<ResultPartDescription>;
    };

const imageMediaType = /^image\/[a-z0-9.+-]+$/i;

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

function groupIntoTurns(
  entries: ReadonlyArray<SessionEntryResponse>,
  openText: string | undefined,
): ReadonlyArray<SessionTurnDescription> {
  const turns: Array<{ id: string; prompt?: PromptEntry; entries: AgentEntry[] }> = [];
  for (const entry of entries) {
    if (entry.kind === 'prompt') {
      turns.push({ id: entry.id, prompt: entry, entries: [] });
    } else {
      if (turns.length === 0) turns.push({ id: 'start', entries: [] });
      turns[turns.length - 1]?.entries.push(entry);
    }
  }
  if (openText === undefined) return turns;
  if (turns.length === 0) turns.push({ id: 'start', entries: [] });
  return turns.map((turn, position) =>
    position === turns.length - 1 ? { ...turn, openText } : turn,
  );
}

function hasNothingToShow(view: { entries: ReadonlyArray<unknown>; openText?: string }): boolean {
  return view.entries.length === 0 && view.openText === undefined;
}

/** A result's body is described only when `open`. */
export function describeSessionEntry(entry: AgentEntry, open: boolean): SessionEntryDescription {
  switch (entry.kind) {
    case 'text':
      return { kind: 'text', text: entry.text };
    case 'tool-call':
      return {
        kind: 'tool-call',
        name: entry.name,
        input: JSON.stringify(entry.input, null, 2) ?? '',
      };
    case 'tool-result': {
      const label = entry.isError ? 'Result (error)' : 'Result';
      if (!open) return { kind: 'tool-result', label, open };
      return {
        kind: 'tool-result',
        label,
        open,
        parts: entry.parts.flatMap((part): ResultPartDescription[] => {
          if (part.kind === 'text') return [part];
          if (!imageMediaType.test(part.mediaType)) return [];
          return [{ kind: 'image', src: `data:${part.mediaType};base64,${part.data}` }];
        }),
      };
    }
  }
}
