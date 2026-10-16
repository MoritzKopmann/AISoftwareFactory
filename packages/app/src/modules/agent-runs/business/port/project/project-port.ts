import type { RunTarget } from '../../domain/types/run-target.js';

export interface ProjectPort {
  find(projectId: string, ticketNumber: number): Promise<RunTarget | undefined>;
}
