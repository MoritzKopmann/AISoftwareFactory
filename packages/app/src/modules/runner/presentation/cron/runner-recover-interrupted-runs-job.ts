import type { RunEndService } from '../../business/service/run-end-service.js';

/** Job `runner.recover-interrupted-runs`: ends runs a crash left running and replays unsettled ones. */
export function createRunnerRecoverInterruptedRunsJob(
  runEndService: RunEndService,
): () => Promise<void> {
  return () => runEndService.recoverInterrupted();
}
