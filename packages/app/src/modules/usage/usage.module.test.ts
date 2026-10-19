import { describe, expect, it } from 'vitest';
import type { DomainEvents } from '../../shared/event-bus.js';
import { domainEventNames } from '../../shared/event-bus.js';
import { InMemoryEventBus } from '../../shared/in-memory-event-bus.js';
import { FakeClock } from '../../shared/testing/fake-clock.js';
import { usageResponseSchema } from './presentation/dto/api/usage-schemas.js';
import { InMemoryUsageRepository } from './testing/in-memory-usage-repository.js';
import { createUsageModule } from './index.js';

type Observed = DomainEvents['usage.window-observed'];

function observation(overrides: Partial<Observed> = {}): Observed {
  return {
    observedAt: '2026-10-18T10:00:00.000Z',
    fiveHour: { utilizationPercent: 42, resetsAt: '2026-10-18T14:00:00.000Z' },
    sevenDay: null,
    refusedUntil: null,
    ...overrides,
  };
}

function createSubject(now = '2026-10-18T12:00:00.000Z') {
  const events = new InMemoryEventBus<DomainEvents>();
  const clock = new FakeClock(now);
  const loggedErrors: string[] = [];
  const changed: unknown[] = [];
  events.on('usage.changed', (payload) => changed.push(payload));
  const usageRepository = new InMemoryUsageRepository();
  const usage = createUsageModule(
    {
      database: undefined as never,
      clock,
      events,
      logger: { info: () => {}, warn: () => {}, error: (message) => loggedErrors.push(message) },
    },
    { usageRepository },
  );
  return { usage, events, clock, changed, loggedErrors, usageRepository };
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
}

describe('usage module', () => {
  it('should store the window and publish usage.changed once when a window is observed', async () => {
    const { usage, events, changed } = createSubject();

    events.emit('usage.window-observed', observation());
    await settle();
    const status = await usage.internal.status();

    expect(status.fiveHour?.utilizationPercent).toBe(42);
    expect(changed).toHaveLength(1);
  });

  it('should stay quiet when the same windows are observed again later', async () => {
    const { events, changed } = createSubject();
    events.emit('usage.window-observed', observation());
    await settle();

    events.emit('usage.window-observed', observation({ observedAt: '2026-10-18T11:00:00.000Z' }));
    await settle();

    expect(changed).toHaveLength(1);
  });

  it('should show a pause when calls are refused', async () => {
    const { usage, events } = createSubject();

    events.emit(
      'usage.window-observed',
      observation({ fiveHour: null, refusedUntil: '2026-10-18T15:00:00.000Z' }),
    );
    await settle();

    expect((await usage.internal.status()).pausedUntil).toBe('2026-10-18T15:00:00.000Z');
  });

  it('should show no pause when the clock reaches the pause end', async () => {
    const { usage, events, clock } = createSubject();
    events.emit('usage.window-observed', observation({ refusedUntil: '2026-10-18T15:00:00.000Z' }));
    await settle();

    clock.setNow('2026-10-18T15:00:00.000Z');

    expect((await usage.internal.status()).pausedUntil).toBeNull();
  });

  it('should log the error and publish nothing when recording fails', async () => {
    const { events, changed, loggedErrors, usageRepository } = createSubject();
    usageRepository.save = async () => {
      throw new Error('disk full');
    };

    events.emit('usage.window-observed', observation());
    await settle();

    expect(loggedErrors).toEqual([expect.stringContaining('disk full')]);
    expect(changed).toHaveLength(0);
  });

  it('should answer 200 with every field null when GET /api/usage is called without data', async () => {
    const { usage } = createSubject();

    const response = await usage.routes.request('/api/usage');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      pausedUntil: null,
      observedAt: null,
      fiveHour: null,
      sevenDay: null,
    });
  });

  it('should answer a body matching usageResponseSchema when GET /api/usage is called with data', async () => {
    const { usage, events } = createSubject();
    events.emit(
      'usage.window-observed',
      observation({
        sevenDay: { utilizationPercent: 10, resetsAt: '2026-10-22T00:00:00.000Z' },
        refusedUntil: '2026-10-18T15:00:00.000Z',
      }),
    );
    await settle();

    const response = await usage.routes.request('/api/usage');
    const body = usageResponseSchema.parse(await response.json());

    expect(body).toEqual({
      pausedUntil: '2026-10-18T15:00:00.000Z',
      observedAt: '2026-10-18T10:00:00.000Z',
      fiveHour: { utilizationPercent: 42, resetsAt: '2026-10-18T14:00:00.000Z' },
      sevenDay: { utilizationPercent: 10, resetsAt: '2026-10-22T00:00:00.000Z' },
    });
  });

  it('should list usage.changed in domainEventNames', () => {
    expect(domainEventNames).toContain('usage.changed');
  });
});
