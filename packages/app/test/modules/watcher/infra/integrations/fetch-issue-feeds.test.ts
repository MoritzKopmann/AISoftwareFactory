import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FetchIssueFeeds } from '../../../../../src/modules/watcher/infra/integrations/fetch-issue-feeds.js';
import { FakeGitHubToken, ScriptedFetch } from '../../fakes/fake-watcher-ports.js';

const repository = { owner: 'octo', name: 'hello' };
const issuesFeedUrl =
  'https://api.github.com/repos/octo/hello/issues?state=all&sort=updated&direction=desc&per_page=1';
const eventsFeedUrl = 'https://api.github.com/repos/octo/hello/issues/events?per_page=1';

const issuesFeedBody = readFileSync(
  new URL('../../../../fixtures/github/issues-feed.json', import.meta.url),
  'utf8',
);
const eventsFeedBody = readFileSync(
  new URL('../../../../fixtures/github/issue-events-feed.json', import.meta.url),
  'utf8',
);

function changedIssuesFeed(entityTag: string): Response {
  return new Response(issuesFeedBody, { status: 200, headers: { etag: entityTag } });
}

function changedEventsFeed(entityTag: string): Response {
  return new Response(eventsFeedBody, { status: 200, headers: { etag: entityTag } });
}

function unchangedFeed(): Response {
  return new Response(null, { status: 304 });
}

function createFeeds(scriptedFetch: ScriptedFetch): FetchIssueFeeds {
  return new FetchIssueFeeds({
    fetch: scriptedFetch.fetch,
    token: new FakeGitHubToken(['token']),
  });
}

describe('FetchIssueFeeds', () => {
  describe('changedSince', () => {
    it('should return true and request both feeds without If-None-Match when the repository is seen for the first time', async () => {
      const scriptedFetch = new ScriptedFetch([
        changedIssuesFeed('"issues-1"'),
        changedEventsFeed('"events-1"'),
      ]);

      const changed = await createFeeds(scriptedFetch).changedSince(repository);

      expect(changed).toBe(true);
      expect(scriptedFetch.requests.map((request) => request.url)).toEqual([
        issuesFeedUrl,
        eventsFeedUrl,
      ]);
      expect(scriptedFetch.requests.map((request) => request.headers.get('if-none-match'))).toEqual(
        [null, null],
      );
    });

    it('should return false and send If-None-Match on both feeds when both answer 304', async () => {
      const scriptedFetch = new ScriptedFetch([
        changedIssuesFeed('"issues-1"'),
        changedEventsFeed('"events-1"'),
        unchangedFeed(),
        unchangedFeed(),
      ]);
      const feeds = createFeeds(scriptedFetch);
      await feeds.changedSince(repository);

      const changed = await feeds.changedSince(repository);

      expect(changed).toBe(false);
      expect(
        scriptedFetch.requests.slice(2).map((request) => request.headers.get('if-none-match')),
      ).toEqual(['"issues-1"', '"events-1"']);
    });

    it('should return true and send the new ETag next time when only the events feed answers 200', async () => {
      const scriptedFetch = new ScriptedFetch([
        changedIssuesFeed('"issues-1"'),
        changedEventsFeed('"events-1"'),
        unchangedFeed(),
        changedEventsFeed('"events-2"'),
        unchangedFeed(),
        unchangedFeed(),
      ]);
      const feeds = createFeeds(scriptedFetch);
      await feeds.changedSince(repository);

      const changedAfterEvent = await feeds.changedSince(repository);
      const changedAfterwards = await feeds.changedSince(repository);

      expect(changedAfterEvent).toBe(true);
      expect(changedAfterwards).toBe(false);
      expect(
        scriptedFetch.requests.slice(4).map((request) => request.headers.get('if-none-match')),
      ).toEqual(['"issues-1"', '"events-2"']);
    });

    it('should return true when another repository is seen for the first time', async () => {
      const scriptedFetch = new ScriptedFetch([
        changedIssuesFeed('"issues-1"'),
        changedEventsFeed('"events-1"'),
        changedIssuesFeed('"other-issues-1"'),
        changedEventsFeed('"other-events-1"'),
      ]);
      const feeds = createFeeds(scriptedFetch);
      await feeds.changedSince(repository);

      const changed = await feeds.changedSince({ owner: 'octo', name: 'other' });

      expect(changed).toBe(true);
      expect(scriptedFetch.requests[2]?.headers.get('if-none-match')).toBeNull();
    });
  });
});
