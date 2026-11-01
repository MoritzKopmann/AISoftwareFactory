import { randomUUID } from 'node:crypto';
import type { Run } from '../domain/types/run.js';
import { RunNotResumableError } from '../errors/run-not-resumable-error.js';
import type { RunRepository } from '../port/repository/run-repository.js';
import type { AgentSessions } from '../port/session/agent-sessions.js';
import type { SessionFeed } from '../port/session/session-feed.js';
import type { RunStartService } from './run-start-service.js';

export type RunMessageServiceDependencies = {
  readonly runRepository: RunRepository;
  readonly agentSessions: Pick<AgentSessions, 'send'>;
  readonly sessionFeed: Pick<SessionFeed, 'publish'>;
  readonly runStartService: Pick<RunStartService, 'resume'>;
};

/** Hands a human's message to a run: into the live session, or by resuming the ended run. */
export class RunMessageService {
  constructor(private readonly dependencies: RunMessageServiceDependencies) {}

  /** `undefined` when the live session took the message, else the resumed run. */
  async send(runId: string, text: string): Promise<Run | undefined> {
    const { runRepository, agentSessions, sessionFeed, runStartService } = this.dependencies;

    const run = await runRepository.findById(runId);
    if (run === undefined || run.ending?.kind === 'stopped') {
      throw new RunNotResumableError(`Run ${runId} cannot take a message`);
    }
    if (run.ending === undefined) {
      const messageId = randomUUID();
      if (agentSessions.send(run.sessionId, messageId, text) === 'pushed') {
        sessionFeed.publish(runId, {
          kind: 'entry',
          entry: { kind: 'prompt', id: `${messageId}#0`, text },
        });
        return undefined;
      }
    }
    return runStartService.resume(runId, { kind: 'message', text });
  }
}
