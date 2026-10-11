import type { RepositoryReference } from '../../logic/domain/types/repository-reference.js';
import type { GitHubToken } from '../../logic/ports/github-token.js';
import type { IssueFeeds } from '../../logic/ports/issue-feeds.js';
import { requestGitHub } from './request-github.js';

const requestTimeoutMilliseconds = 15_000;

export type FetchIssueFeedsDependencies = {
  readonly fetch: typeof fetch;
  readonly token: GitHubToken;
};

export class FetchIssueFeeds implements IssueFeeds {
  private readonly entityTagsByFeedUrl = new Map<string, string>();

  constructor(private readonly dependencies: FetchIssueFeedsDependencies) {}

  async changedSince(repository: RepositoryReference): Promise<boolean> {
    const repositoryPath = `https://api.github.com/repos/${repository.owner}/${repository.name}`;
    const feedUrls = [
      `${repositoryPath}/issues?state=all&sort=updated&direction=desc&per_page=1`,
      `${repositoryPath}/issues/events?per_page=1`,
    ];

    let changed = false;
    for (const feedUrl of feedUrls) {
      changed = (await this.checkFeed(feedUrl)) || changed;
    }
    return changed;
  }

  private async checkFeed(feedUrl: string): Promise<boolean> {
    const storedEntityTag = this.entityTagsByFeedUrl.get(feedUrl);
    const response = await requestGitHub(
      { ...this.dependencies, timeoutMilliseconds: requestTimeoutMilliseconds },
      feedUrl,
      storedEntityTag === undefined ? {} : { 'if-none-match': storedEntityTag },
    );
    await response.body?.cancel();
    if (response.status === 304) {
      return false;
    }
    const newEntityTag = response.headers.get('etag');
    if (newEntityTag === null) {
      this.entityTagsByFeedUrl.delete(feedUrl);
    } else {
      this.entityTagsByFeedUrl.set(feedUrl, newEntityTag);
    }
    return true;
  }
}
