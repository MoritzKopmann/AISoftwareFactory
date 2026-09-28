import type { CredentialSnapshot } from '../domain/types/credential-snapshot.js';

export interface CredentialSource {
  read(): Promise<CredentialSnapshot>;
}
