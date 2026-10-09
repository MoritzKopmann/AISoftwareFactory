import type { CredentialSnapshot } from '../../logic/domain/types/credential-snapshot.js';
import type { SkillsStatus } from '../../logic/domain/types/skills-status.js';
import type { SkillsStatusStore } from '../../logic/ports/skills-status-store.js';

export class InMemorySkillsStatusStore implements SkillsStatusStore {
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
