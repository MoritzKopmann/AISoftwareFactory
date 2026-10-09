import type { TicketArtifactsResponse } from '@aisf/app/api-schemas/artifacts-schemas.js';
import { describe, expect, it } from 'vitest';
import { describeArtifactLinks } from '../../src/tickets/describe-artifact-links.js';

const openResponse: TicketArtifactsResponse = {
  artifacts: [{ artifactId: 'confirm', title: 'Confirm the plan', url: '/a/tok/', status: 'open' }],
};

describe('describeArtifactLinks', () => {
  it('should return no links and no error when nothing has been read yet', () => {
    expect(describeArtifactLinks(undefined, undefined)).toEqual({ links: [] });
  });

  it('should link each open page by its title and show no error when the route lists it open', () => {
    expect(describeArtifactLinks(openResponse, undefined)).toEqual({
      links: [{ artifactId: 'confirm', label: 'Open page: Confirm the plan', url: '/a/tok/' }],
    });
  });

  it('should skip busy and closed pages', () => {
    const response: TicketArtifactsResponse = {
      artifacts: [
        { artifactId: 'a', title: 'A', url: '/a/1/', status: 'busy' },
        { artifactId: 'b', title: 'B', url: '/a/2/', status: 'closed' },
      ],
    };
    expect(describeArtifactLinks(response, undefined).links).toEqual([]);
  });

  it('should keep the last good links and add the network error when the next read failed', () => {
    expect(
      describeArtifactLinks(openResponse, { kind: 'network', message: 'Failed to fetch' }),
    ).toEqual({
      links: [{ artifactId: 'confirm', label: 'Open page: Confirm the plan', url: '/a/tok/' }],
      error: {
        message: "Couldn't load the artifact links. Can't reach aisf.",
        hint: 'Loads again on the next change, or on Retry.',
        detail: 'Failed to fetch',
      },
    });
  });

  it('should show only the error when the first read failed', () => {
    expect(describeArtifactLinks(undefined, { kind: 'network', message: 'down' })).toEqual({
      links: [],
      error: {
        message: "Couldn't load the artifact links. Can't reach aisf.",
        hint: 'Loads again on the next change, or on Retry.',
        detail: 'down',
      },
    });
  });

  it('should name the status in the message and the detail when the route answered an error', () => {
    expect(describeArtifactLinks(undefined, { kind: 'not-ok', status: 500 }).error).toEqual({
      message: "Couldn't load the artifact links. The artifacts route answered 500.",
      hint: 'Loads again on the next change, or on Retry.',
      detail: '500',
    });
  });
});
