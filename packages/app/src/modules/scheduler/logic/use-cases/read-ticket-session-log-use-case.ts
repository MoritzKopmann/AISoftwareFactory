import type { SessionLog } from '../domain/types/session-log.js';
import type { RunnerPort } from '../ports/runner-port.js';

export type ReadTicketSessionLogDependencies = {
  readonly runner: RunnerPort;
};

export class ReadTicketSessionLogUseCase {
  constructor(private readonly dependencies: ReadTicketSessionLogDependencies) {}

  async execute(projectId: string, ticketNumber: number): Promise<SessionLog> {
    const { runner } = this.dependencies;

    const latestRun = await runner.latestRun(projectId, ticketNumber);
    if (latestRun === undefined) {
      return { kind: 'no-session' };
    }
    return runner.sessionLog(latestRun.id);
  }
}
