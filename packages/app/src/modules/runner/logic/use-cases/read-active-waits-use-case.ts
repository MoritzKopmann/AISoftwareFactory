import type { ActiveWait } from '../domain/types/active-wait.js';
import type { RunRepository } from '../ports/run-repository.js';

export type ReadActiveWaitsDependencies = {
  readonly runRepository: RunRepository;
};

export class ReadActiveWaitsUseCase {
  constructor(private readonly dependencies: ReadActiveWaitsDependencies) {}

  async execute(projectId: string): Promise<ReadonlyArray<ActiveWait>> {
    const runs = await this.dependencies.runRepository.listActive(projectId);
    return runs.flatMap((run) => {
      const { waitingFor, waitingSince } = run;
      if (waitingFor === undefined || waitingSince === undefined) {
        return [];
      }
      const kind =
        waitingFor.kind === 'permission-needed'
          ? 'permission'
          : waitingFor.artifactId === undefined
            ? 'question'
            : 'round';
      return [{ ticketNumber: run.ticketNumber, kind, since: waitingSince }];
    });
  }
}
