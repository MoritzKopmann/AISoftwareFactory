import { describe, expect, it, vi } from 'vitest';
import { subscribeToProjectAdded } from './subscribe-to-project-added.js';
import type { TicketRunService } from '../../business/service/ticket-run-service.js';
import type { DomainEvents } from '../../../../shared/event-bus.js';
import { InMemoryEventBus } from '../../../../shared/in-memory-event-bus.js';

const projectAdded: DomainEvents['project.added'] = {
  projectId: 'o/n',
  repository: { owner: 'o', name: 'n' },
  checkoutPath: '/tmp/o/n',
};

function buildSubject(startOnboarding: TicketRunService['startOnboarding'] = async () => 1) {
  const bus = new InMemoryEventBus<DomainEvents>();
  const startOnboardingSpy = vi.fn(startOnboarding);
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  subscribeToProjectAdded(bus, { startOnboarding: startOnboardingSpy }, logger);
  return { bus, startOnboardingSpy, logger };
}

describe('subscribeToProjectAdded', () => {
  it('should start onboarding of the project when project.added is emitted', async () => {
    const { bus, startOnboardingSpy } = buildSubject();

    bus.emit('project.added', projectAdded);

    await vi.waitFor(() => expect(startOnboardingSpy).toHaveBeenCalledWith('o/n', 'project-added'));
  });

  it('should log the failure and not throw when startOnboarding rejects', async () => {
    const { bus, logger } = buildSubject(async () => {
      throw new Error('boom');
    });

    expect(() => bus.emit('project.added', projectAdded)).not.toThrow();

    await vi.waitFor(() =>
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('boom')),
    );
  });
});
