import { Hono } from 'hono';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createFindingsRoutes,
  type FindingsPort,
} from '../../../../../src/modules/ui/api/routes/create-findings-routes.js';
import { findingsResponseSchema } from '../../../../../src/modules/ui/api/schemas/findings-schemas.js';
import {
  FindingNotFoundError,
  FindingNotOpenError,
  type Finding,
} from '../../../../../src/modules/findings/index.js';
import { buildFinding } from '../../../findings/fakes/build-finding.js';

class FakeFindings implements FindingsPort {
  readonly calls: string[] = [];
  findings: ReadonlyArray<Finding> = [];
  error: Error | undefined;

  async list(projectId: string, ticketNumber?: number): Promise<ReadonlyArray<Finding>> {
    this.calls.push(`list ${projectId} ${ticketNumber ?? 'all'}`);
    return this.findings;
  }

  async createTicket(projectId: string, findingId: number): Promise<Finding> {
    this.calls.push(`ticket ${projectId} ${findingId}`);
    if (this.error !== undefined) {
      throw this.error;
    }
    return buildFinding({ id: findingId, state: 'ticketed', createdTicketNumber: 207 });
  }

  async dismiss(projectId: string, findingId: number): Promise<Finding> {
    this.calls.push(`dismiss ${projectId} ${findingId}`);
    if (this.error !== undefined) {
      throw this.error;
    }
    return buildFinding({
      id: findingId,
      state: 'dismissed',
      resolvedAt: '2026-09-29T11:00:00.000Z',
    });
  }
}

describe('createFindingsRoutes', () => {
  let findings: FakeFindings;
  let app: Hono;

  beforeEach(() => {
    findings = new FakeFindings();
    app = new Hono().route('/projects', createFindingsRoutes(findings));
  });

  describe('GET /:owner/:name/findings', () => {
    it('should answer 200 with the project findings when no ticket is given', async () => {
      findings.findings = [buildFinding(), buildFinding({ id: 2, ticketNumber: 142 })];

      const response = await app.request('/projects/moritz/aisf/findings');

      expect(response.status).toBe(200);
      const body = findingsResponseSchema.parse(await response.json());
      expect(body.findings.map(({ id }) => id)).toEqual([1, 2]);
      expect(findings.calls).toEqual(['list moritz/aisf all']);
    });

    it('should list only that ticket when the ticket query is given', async () => {
      await app.request('/projects/moritz/aisf/findings?ticket=141');

      expect(findings.calls).toEqual(['list moritz/aisf 141']);
    });

    it('should answer 400 when the ticket query is not a positive integer', async () => {
      const response = await app.request('/projects/moritz/aisf/findings?ticket=abc');

      expect(response.status).toBe(400);
      expect(findings.calls).toEqual([]);
    });

    it('should carry the created ticket number when a finding is ticketed', async () => {
      findings.findings = [buildFinding({ state: 'ticketed', createdTicketNumber: 207 })];

      const response = await app.request('/projects/moritz/aisf/findings');

      expect(findingsResponseSchema.parse(await response.json()).findings).toMatchObject([
        { state: 'ticketed', createdTicketNumber: 207 },
      ]);
    });
  });

  describe('POST /:owner/:name/findings/:id/ticket', () => {
    it('should answer 200 with the ticketed finding when Create ticket is used', async () => {
      const response = await app.request('/projects/moritz/aisf/findings/1/ticket', {
        method: 'POST',
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        id: 1,
        state: 'ticketed',
        createdTicketNumber: 207,
      });
      expect(findings.calls).toEqual(['ticket moritz/aisf 1']);
    });

    it('should answer 404 when the finding is unknown', async () => {
      findings.error = new FindingNotFoundError('no finding');

      const response = await app.request('/projects/moritz/aisf/findings/9/ticket', {
        method: 'POST',
      });

      expect(response.status).toBe(404);
    });

    it('should answer 409 when the finding is not open', async () => {
      findings.error = new FindingNotOpenError('not open');

      const response = await app.request('/projects/moritz/aisf/findings/1/ticket', {
        method: 'POST',
      });

      expect(response.status).toBe(409);
    });

    it('should answer 400 when the finding id is not a positive integer', async () => {
      const response = await app.request('/projects/moritz/aisf/findings/abc/ticket', {
        method: 'POST',
      });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /:owner/:name/findings/:id/dismiss', () => {
    it('should answer 200 with the dismissed finding when Dismiss is used', async () => {
      const response = await app.request('/projects/moritz/aisf/findings/1/dismiss', {
        method: 'POST',
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ id: 1, state: 'dismissed' });
      expect(findings.calls).toEqual(['dismiss moritz/aisf 1']);
    });

    it('should answer 404 when the finding is unknown', async () => {
      findings.error = new FindingNotFoundError('no finding');

      const response = await app.request('/projects/moritz/aisf/findings/9/dismiss', {
        method: 'POST',
      });

      expect(response.status).toBe(404);
    });

    it('should answer 409 when the finding is not open', async () => {
      findings.error = new FindingNotOpenError('not open');

      const response = await app.request('/projects/moritz/aisf/findings/1/dismiss', {
        method: 'POST',
      });

      expect(response.status).toBe(409);
    });
  });
});
