import type { RunPage } from '../domain/types/run-page.js';

export interface RunPageLookup {
  find(projectId: string, ticketNumber: number, artifactId: string): Promise<RunPage | undefined>;
}
