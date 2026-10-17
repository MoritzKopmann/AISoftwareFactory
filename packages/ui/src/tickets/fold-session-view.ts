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
      /** The stream dropped and the browser is reconnecting; the next snapshot clears it. */
      readonly connectionLost: boolean;
    };

export const initialSessionView: SessionView = { kind: 'waiting' };

export function markConnectionLost(view: SessionView): SessionView {
  return isConnected(view) ? { ...view, connectionLost: true } : view;
}

function isConnected(view: SessionView): view is Extract<SessionView, { kind: 'entries' }> {
  return view.kind === 'entries' && !view.connectionLost;
}

export function foldSessionView(view: SessionView, frame: SessionStreamFrame): SessionView {
  switch (frame.kind) {
    case 'snapshot':
      return { kind: 'entries', entries: frame.entries, ended: false, connectionLost: false };
    case 'no-session':
    case 'transcript-not-found':
      return { kind: frame.kind };
    case 'entry': {
      const { entries, ended, connectionLost } =
        view.kind === 'entries' ? view : { entries: [], ended: false, connectionLost: false };
      return { kind: 'entries', entries: [...entries, frame.entry], ended, connectionLost };
    }
    case 'delta': {
      const { entries, openText, ended, connectionLost } =
        view.kind === 'entries'
          ? view
          : { entries: [], openText: undefined, ended: false, connectionLost: false };
      if (frame.opensBlock) {
        return { kind: 'entries', entries, openText: frame.text, ended, connectionLost };
      }
      // A block already open when the page connected: ignored, its entry shows it whole.
      if (openText === undefined) return view;
      return { kind: 'entries', entries, openText: openText + frame.text, ended, connectionLost };
    }
    case 'ended':
      return view.kind === 'entries' ? { ...view, ended: true } : view;
  }
}
