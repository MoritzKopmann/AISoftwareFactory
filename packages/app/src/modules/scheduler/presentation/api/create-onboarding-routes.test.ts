import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import type { TicketRunService } from '../../business/service/ticket-run-service.js';
import { createOnboardingRoutes } from './create-onboarding-routes.js';
import { onboardingResponseSchema } from '../dto/api/onboarding-schemas.js';
import { OnboardingNotNeededError } from '../../business/errors/onboarding-not-needed-error.js';
import { ProjectNotFoundError } from '../../business/errors/project-not-found-error.js';

type Onboardings = Pick<TicketRunService, 'startOnboarding'>;

class FakeOnboardings implements Onboardings {
  failure: Error | undefined;
  readonly calls: string[] = [];

  async startOnboarding(
    projectId: string,
    trigger: 'project-added' | 'manual',
  ): Promise<number | undefined> {
    this.calls.push(`start ${projectId} ${trigger}`);
    if (this.failure !== undefined) {
      throw this.failure;
    }
    return 412;
  }
}

async function post(onboardings: Onboardings): Promise<Response> {
  return new Hono()
    .route('/projects', createOnboardingRoutes(onboardings))
    .request('/projects/o/n/onboarding', { method: 'POST' });
}

describe('createOnboardingRoutes', () => {
  it('should answer 201 with the ticket number when onboarding starts', async () => {
    const onboardings = new FakeOnboardings();

    const response = await post(onboardings);

    expect(response.status).toBe(201);
    expect(onboardingResponseSchema.parse(await response.json())).toEqual({ ticketNumber: 412 });
    expect(onboardings.calls).toEqual(['start o/n manual']);
  });

  it('should answer 409 when the project is already onboarded', async () => {
    const onboardings = new FakeOnboardings();
    onboardings.failure = new OnboardingNotNeededError('already onboarded');

    const response = await post(onboardings);

    expect(response.status).toBe(409);
  });

  it('should answer 404 when the project is unknown', async () => {
    const onboardings = new FakeOnboardings();
    onboardings.failure = new ProjectNotFoundError('unknown');

    const response = await post(onboardings);

    expect(response.status).toBe(404);
  });
});
