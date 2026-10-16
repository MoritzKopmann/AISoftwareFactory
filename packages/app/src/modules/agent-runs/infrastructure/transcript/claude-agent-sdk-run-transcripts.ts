import type { SDKAssistantMessage } from '@anthropic-ai/claude-agent-sdk';
import { getSessionMessages } from '@anthropic-ai/claude-agent-sdk';
import type { RunLogEntry } from '../../business/domain/types/run-log-entry.js';
import { TranscriptNotFoundError } from '../../business/errors/transcript-not-found-error.js';
import type { RunTranscripts } from '../../business/port/transcript/run-transcripts.js';
import type { SessionEntry } from '../../business/domain/types/session-entry.js';
import {
  describeAssistantMessage,
  entriesFromContent,
  isFromMainAgent,
} from '../session/map-sdk-message.js';

async function readMessages(sessionId: string, worktreePath: string) {
  const messages = await getSessionMessages(sessionId, { dir: worktreePath });
  // The SDK answers an empty list for a transcript it cannot find.
  if (messages.length === 0) {
    throw new TranscriptNotFoundError(`No transcript found for session ${sessionId}`);
  }
  return messages;
}

export class ClaudeAgentSdkRunTranscripts implements RunTranscripts {
  async readEntries(sessionId: string, worktreePath: string): Promise<ReadonlyArray<SessionEntry>> {
    const messages = await readMessages(sessionId, worktreePath);
    return messages
      .filter(isFromMainAgent)
      .flatMap((message) =>
        message.type === 'system'
          ? []
          : entriesFromContent(
              message.uuid,
              message.type,
              (message.message as { content?: unknown }).content,
              true,
            ),
      );
  }

  async read(sessionId: string, worktreePath: string): Promise<ReadonlyArray<RunLogEntry>> {
    const messages = await readMessages(sessionId, worktreePath);

    return messages
      .filter((message) => message.type === 'assistant')
      .flatMap((message) =>
        describeAssistantMessage(message.message as SDKAssistantMessage['message']).map(
          (summary) => ({ summary }),
        ),
      );
  }
}
