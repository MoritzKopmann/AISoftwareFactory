import type { CredentialSnapshot } from '../domain/types/credential-snapshot.js';
import type { SkillsStatus } from '../domain/types/skills-status.js';

export interface SkillsStatusStore {
  status(): SkillsStatus;
  credentials(): CredentialSnapshot | undefined;
  save(status: SkillsStatus, credentials: CredentialSnapshot): void;
}
