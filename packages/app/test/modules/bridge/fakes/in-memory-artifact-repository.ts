import type { Artifact } from '../../../../src/modules/bridge/logic/domain/types/artifact.js';
import type {
  ArtifactRepository,
  NewArtifact,
} from '../../../../src/modules/bridge/logic/ports/artifact-repository.js';

export class InMemoryArtifactRepository implements ArtifactRepository {
  private artifacts: ReadonlyArray<Artifact> = [];

  async publish(newArtifact: NewArtifact): Promise<Artifact> {
    const existing = this.artifacts.find(
      ({ projectId, ticketNumber, artifactId }) =>
        projectId === newArtifact.projectId &&
        ticketNumber === newArtifact.ticketNumber &&
        artifactId === newArtifact.artifactId,
    );
    const stored: Artifact =
      existing === undefined
        ? { ...newArtifact, version: 1 }
        : { ...newArtifact, token: existing.token, version: existing.version + 1 };
    this.artifacts = [...this.artifacts.filter((artifact) => artifact !== existing), stored];
    return stored;
  }

  add(artifact: Artifact): void {
    this.artifacts = [...this.artifacts, artifact];
  }

  async findByToken(token: string): Promise<Artifact | undefined> {
    return this.artifacts.find((artifact) => artifact.token === token);
  }

  async listForTicket(projectId: string, ticketNumber: number): Promise<ReadonlyArray<Artifact>> {
    return this.artifacts.filter(
      (artifact) => artifact.projectId === projectId && artifact.ticketNumber === ticketNumber,
    );
  }
}
