import type { SessionEntry } from '../../../business/domain/types/session-entry.js';
import type { TicketSessionWatchEvent } from '../../../business/domain/types/ticket-session-watch.js';
import type { SessionEntryResponse, SessionStreamFrame } from '../api/session-stream-schemas.js';

function toSessionEntryResponse(entry: SessionEntry): SessionEntryResponse {
  switch (entry.kind) {
    case 'prompt':
    case 'text':
      return { kind: entry.kind, id: entry.id, text: entry.text };
    case 'handback':
      return { kind: 'handback', id: entry.id, agentId: entry.agentId, text: entry.text };
    case 'tool-call':
      return {
        kind: 'tool-call',
        id: entry.id,
        toolUseId: entry.toolUseId,
        name: entry.name,
        input: entry.input,
        ...(entry.label !== undefined && { label: entry.label }),
      };
    case 'tool-result':
      return {
        kind: 'tool-result',
        id: entry.id,
        toolUseId: entry.toolUseId,
        isError: entry.isError,
        parts: entry.parts.map((part) =>
          part.kind === 'text'
            ? { kind: 'text', text: part.text }
            : { kind: 'image', mediaType: part.mediaType, data: part.data },
        ),
        ...(entry.agentId === undefined ? {} : { agentId: entry.agentId }),
      };
  }
}

export function toSessionStreamFrame(event: TicketSessionWatchEvent): SessionStreamFrame {
  switch (event.kind) {
    case 'snapshot':
      return {
        kind: 'snapshot',
        entries: event.entries.map(toSessionEntryResponse),
        root: event.root,
      };
    case 'entry':
      return { kind: 'entry', entry: toSessionEntryResponse(event.entry) };
    case 'delta':
      return { kind: 'delta', opensBlock: event.opensBlock, text: event.text };
    case 'label':
      return { kind: 'label', toolUseId: event.toolUseId, label: event.label };
    case 'no-session':
    case 'transcript-not-found':
    case 'ended':
      return { kind: event.kind };
  }
}
