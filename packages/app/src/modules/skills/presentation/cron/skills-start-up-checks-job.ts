import type { Logger } from '../../../../shared/logger/create-logger.js';
import type { SkillsStartupService } from '../../business/service/skills-startup-service.js';

/** Job `skills.start-up-checks`: runs the checks, then logs when they leave runs blocked. */
export function createSkillsStartUpChecksJob(
  startupService: SkillsStartupService,
  logger: Logger,
): () => Promise<void> {
  return async () => {
    await startupService.start();
    const runsBlocked = startupService.readRunsBlocked();
    if (runsBlocked.blocked) {
      logger.error(`Runs are blocked: ${runsBlocked.reason}`);
    }
  };
}
