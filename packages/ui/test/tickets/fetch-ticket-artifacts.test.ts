import type { TicketArtifactsResponse } from '@aisf/app/api-schemas/artifacts-schemas.js';
import { describe, expect, it } from 'vitest';
import { fetchTicketArtifacts } from '../../src/tickets/fetch-ticket-artifacts.js';

const response: TicketArtifactsResponse = {
  artifacts: [{ artifactId: 'confirm', title: 'Confirm', url: '/a/tok/', status: 'open' }],
};

function answerWith(status: number, body: unknown = response): () => Promise<Response> {
  return () => Promise.resolve(new Response(JSON.stringify(body), { status }));
}

describe('fetchTicketArtifacts', () => {
  it("should ask for the ticket's artifacts under the project's owner and name", async () => {
    const requestedUrls: string[] = [];
    await fetchTicketArtifacts('MoritzKopmann/postkarte', 56, (url) => {
      requestedUrls.push(url);
      return answerWith(200)();
    });
    expect(requestedUrls).toEqual(['/api/projects/MoritzKopmann/postkarte/tickets/56/artifacts']);
  });

  it('should return the parsed response as an answer when the route answers 200', async () => {
    expect(await fetchTicketArtifacts('o/n', 56, answerWith(200))).toEqual({
      kind: 'answer',
      response,
    });
  });

  it('should return request-failed when the route answers an error', async () => {
    expect(await fetchTicketArtifacts('o/n', 56, answerWith(500, {}))).toEqual({
      kind: 'request-failed',
    });
  });

  it('should return request-failed when the request throws', async () => {
    expect(await fetchTicketArtifacts('o/n', 56, () => Promise.reject(new Error('down')))).toEqual({
      kind: 'request-failed',
    });
  });
});
