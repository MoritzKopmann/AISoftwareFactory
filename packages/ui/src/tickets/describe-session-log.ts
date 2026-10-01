import type { SessionLogResponse } from '@aisf/app/api-schemas/runs-schemas.js';
import type { SessionLogOutcome } from './fetch-session-log.js';

export type SessionLogState =
  { readonly kind: 'closed' } | { readonly kind: 'loading' } | SessionLogOutcome;

export type SessionLogDescription =
  | { readonly kind: 'closed' }
  | { readonly kind: 'loading'; readonly loadingLabel: string }
  | {
      readonly kind: 'entries';
      readonly countLabel: string;
      readonly note?: string;
      readonly entries: ReadonlyArray<{ readonly indexLabel: string; readonly summary: string }>;
    }
  | { readonly kind: 'message'; readonly message: string }
  | { readonly kind: 'failed'; readonly message: string; readonly detail: string };

function describeAnswer(response: SessionLogResponse): SessionLogDescription {
  switch (response.kind) {
    case 'no-session':
      return { kind: 'message', message: 'No session yet. A run on this ticket starts one.' };
    case 'transcript-not-found':
      return {
        kind: 'message',
        message: "Transcript not found. Claude Code has removed this session's transcript.",
      };
    case 'found': {
      const { entries, total } = response;
      if (entries.length === 0) {
        return { kind: 'message', message: 'No entries yet.' };
      }
      const countLabel = total.toLocaleString('en-US');
      return {
        kind: 'entries',
        countLabel,
        ...(total > entries.length
          ? { note: `Showing last ${entries.length} of ${countLabel}.` }
          : {}),
        entries: entries.map((entry, position) => ({
          indexLabel: String(total - entries.length + position + 1),
          summary: entry.summary,
        })),
      };
    }
  }
}

export function describeSessionLog(state: SessionLogState): SessionLogDescription {
  switch (state.kind) {
    case 'closed':
      return { kind: 'closed' };
    case 'loading':
      return { kind: 'loading', loadingLabel: 'Loading the session log…' };
    case 'answer':
      return describeAnswer(state.response);
    case 'request-failed':
      return {
        kind: 'failed',
        message: "Couldn't load the session log. Can't reach aisf.",
        detail: state.message,
      };
    case 'answered-error':
      return {
        kind: 'failed',
        message: `Couldn't load the session log. The session log route answered ${state.status}.`,
        detail: String(state.status),
      };
  }
}
