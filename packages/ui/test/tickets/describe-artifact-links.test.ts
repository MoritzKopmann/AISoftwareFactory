import type { TicketArtifactsResponse } from '@aisf/app/api-schemas/artifacts-schemas.js';
import { describe, expect, it } from 'vitest';
import { describeArtifactLinks } from '../../src/tickets/describe-artifact-links.js';

describe('describeArtifactLinks', () => {
  it('should return no links when nothing has been read yet', () => {
    expect(describeArtifactLinks(undefined)).toEqual([]);
  });

  it('should link each open page by its title when the route lists it open', () => {
    const response: TicketArtifactsResponse = {
      artifacts: [
        { artifactId: 'confirm', title: 'Confirm the plan', url: '/a/tok/', status: 'open' },
      ],
    };
    expect(describeArtifactLinks(response)).toEqual([
      { artifactId: 'confirm', label: 'Open page: Confirm the plan', url: '/a/tok/' },
    ]);
  });

  it('should skip busy and closed pages', () => {
    const response: TicketArtifactsResponse = {
      artifacts: [
        { artifactId: 'a', title: 'A', url: '/a/1/', status: 'busy' },
        { artifactId: 'b', title: 'B', url: '/a/2/', status: 'closed' },
      ],
    };
    expect(describeArtifactLinks(response)).toEqual([]);
  });
});
