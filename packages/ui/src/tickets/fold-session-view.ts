import type {
  SessionEntryResponse,
  SessionStreamFrame,
} from '@aisf/app/api-schemas/session-stream-schemas.js';

export type SessionView =
  | { readonly kind: 'waiting' }
  | { readonly kind: 'no-session' }
  | { readonly kind: 'transcript-not-found' }
  | {
      readonly kind: 'entries';
      readonly entries: ReadonlyArray<SessionEntryResponse>;
      /** Streamed text of a block this page saw open; absent otherwise. */
      readonly openText?: string;
      readonly ended: boolean;
    };

export const initialSessionView: SessionView = { kind: 'waiting' };

export function foldSessionView(view: SessionView, frame: SessionStreamFrame): SessionView {
  switch (frame.kind) {
    case 'snapshot':
      return { kind: 'entries', entries: frame.entries, ended: false };
    case 'no-session':
    case 'transcript-not-found':
      return { kind: frame.kind };
    case 'entry': {
      const { entries, ended } = view.kind === 'entries' ? view : { entries: [], ended: false };
      return { kind: 'entries', entries: [...entries, frame.entry], ended };
    }
    case 'delta': {
      const { entries, openText, ended } =
        view.kind === 'entries' ? view : { entries: [], openText: undefined, ended: false };
      if (frame.opensBlock) return { kind: 'entries', entries, openText: frame.text, ended };
      // A block already open when the page connected: ignored, its entry shows it whole.
      if (openText === undefined) return view;
      return { kind: 'entries', entries, openText: openText + frame.text, ended };
    }
    case 'ended':
      return view.kind === 'entries'
        ? { kind: 'entries', entries: view.entries, ended: true }
        : view;
  }
}
