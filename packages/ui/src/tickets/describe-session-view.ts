import type { SessionEntryResponse } from '@aisf/app/api-schemas/session-stream-schemas.js';
import type { SessionView } from './fold-session-view.js';

export type SessionViewDescription =
  | { readonly kind: 'message'; readonly message: string }
  | {
      readonly kind: 'entries';
      readonly entries: ReadonlyArray<SessionEntryResponse>;
      readonly openText?: string;
    };

export type ResultPartDescription =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'image'; readonly src: string };

export type SessionEntryDescription =
  | { readonly kind: 'prompt'; readonly text: string }
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
      return { kind: 'message', message: 'Loading the session…' };
    case 'no-session':
      return { kind: 'message', message: 'No session yet. A run on this ticket starts one.' };
    case 'transcript-not-found':
      return {
        kind: 'message',
        message: "Transcript not found. Claude Code has removed this session's transcript.",
      };
    case 'entries':
      if (hasNothingToShow(view)) {
        return { kind: 'message', message: 'No entries yet.' };
      }
      return {
        kind: 'entries',
        entries: view.entries,
        ...(view.openText === undefined ? {} : { openText: view.openText }),
      };
  }
}

function hasNothingToShow(view: { entries: ReadonlyArray<unknown>; openText?: string }): boolean {
  return view.entries.length === 0 && view.openText === undefined;
}

/** A result's body is described only when `open`. */
export function describeSessionEntry(
  entry: SessionEntryResponse,
  open: boolean,
): SessionEntryDescription {
  switch (entry.kind) {
    case 'prompt':
    case 'text':
      return { kind: entry.kind, text: entry.text };
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
