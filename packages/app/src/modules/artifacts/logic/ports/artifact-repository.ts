import type { Artifact } from '../domain/types/artifact.js';

export type NewArtifact = Omit<Artifact, 'version'>;

export interface ArtifactRepository {
  /** Stores the artifact. A republish keeps the stored token and adds 1 to the version. */
  publish(artifact: NewArtifact): Promise<Artifact>;
  findByToken(token: string): Promise<Artifact | undefined>;
  listForTicket(projectId: string, ticketNumber: number): Promise<ReadonlyArray<Artifact>>;
}
