import type { CredentialSnapshot } from '../../business/domain/types/credential-snapshot.js';
import type { SkillsStatus } from '../../business/domain/types/skills-status.js';
import type { SkillsStatusRepository } from '../../business/port/repository/skills-status-repository.js';

export class InMemorySkillsStatusRepository implements SkillsStatusRepository {
  private currentStatus: SkillsStatus = { state: 'pending' };
  private currentCredentials: CredentialSnapshot | undefined;

  status(): SkillsStatus {
    return this.currentStatus;
  }

  credentials(): CredentialSnapshot | undefined {
    return this.currentCredentials;
  }

  save(status: SkillsStatus, credentials: CredentialSnapshot): void {
    this.currentStatus = status;
    this.currentCredentials = credentials;
  }
}
