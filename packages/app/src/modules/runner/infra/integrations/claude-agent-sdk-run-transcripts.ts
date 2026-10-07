import type { SDKAssistantMessage } from '@anthropic-ai/claude-agent-sdk';
import { getSessionMessages } from '@anthropic-ai/claude-agent-sdk';
import type { RunLogEntry } from '../../logic/domain/types/run-log-entry.js';
import { TranscriptNotFoundError } from '../../logic/errors/transcript-not-found-error.js';
import type { RunTranscripts } from '../../logic/ports/run-transcripts.js';
import { describeAssistantMessage } from './map-sdk-message.js';

export class ClaudeAgentSdkRunTranscripts implements RunTranscripts {
  async read(sessionId: string, worktreePath: string): Promise<ReadonlyArray<RunLogEntry>> {
    const messages = await getSessionMessages(sessionId, { dir: worktreePath });
    // The SDK answers an empty list for a transcript it cannot find.
    if (messages.length === 0) {
      throw new TranscriptNotFoundError(`No transcript found for session ${sessionId}`);
    }

    return messages
      .filter((message) => message.type === 'assistant')
      .flatMap((message) =>
        describeAssistantMessage(message.message as SDKAssistantMessage['message']).map(
          (summary) => ({ summary }),
        ),
      );
  }
}
