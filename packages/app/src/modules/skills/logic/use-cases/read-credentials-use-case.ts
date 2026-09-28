import type { CredentialSnapshot } from '../domain/types/credential-snapshot.js';
import type { CredentialSource } from '../ports/credential-source.js';

export type ReadCredentialsDependencies = {
  readonly credentialSource: CredentialSource;
};

export class ReadCredentialsUseCase {
  constructor(private readonly dependencies: ReadCredentialsDependencies) {}

  execute(): Promise<CredentialSnapshot> {
    return this.dependencies.credentialSource.read();
  }
}
