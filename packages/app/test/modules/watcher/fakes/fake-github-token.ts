import type { GitHubToken } from '../../../../src/modules/watcher/infra/integrations/github-token.js';

export class FakeGitHubToken implements GitHubToken {
  readCount = 0;
  invalidateCount = 0;

  constructor(private readonly tokens: ReadonlyArray<string>) {}

  async read(): Promise<string> {
    const token = this.tokens[Math.min(this.invalidateCount, this.tokens.length - 1)];
    this.readCount += 1;
    return token ?? '';
  }

  invalidate(): void {
    this.invalidateCount += 1;
  }
}
