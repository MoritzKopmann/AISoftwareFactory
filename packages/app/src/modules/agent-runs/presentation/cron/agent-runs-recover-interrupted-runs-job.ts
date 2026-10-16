import type { RunEndService } from '../../business/service/run-end-service.js';

/** Job `agent-runs.recover-interrupted-runs`: ends runs a crash left running and replays unsettled ones. */
export function createAgentRunsRecoverInterruptedRunsJob(
  runEndService: RunEndService,
): () => Promise<void> {
  return () => runEndService.recoverInterrupted();
}
