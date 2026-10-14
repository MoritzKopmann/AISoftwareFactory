import type { RunEndService } from '../../business/service/run-end-service.js';

/** Job `runner.abort-sessions`: stops every live agent session. Runs on a shutdown signal. */
export function createRunnerAbortSessionsJob(runEndService: RunEndService): () => Promise<void> {
  return () => {
    runEndService.abortSessions();
    return Promise.resolve();
  };
}
