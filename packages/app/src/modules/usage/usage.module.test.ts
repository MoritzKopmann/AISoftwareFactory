import { describe, expect, it } from 'vitest';
import type { DomainEvents } from '../../shared/event-bus.js';
import { domainEventNames } from '../../shared/event-bus.js';
import { InMemoryEventBus } from '../../shared/in-memory-event-bus.js';
import { FakeClock } from '../../shared/testing/fake-clock.js';
import { usageResponseSchema } from './presentation/dto/api/usage-schemas.js';
import { UsageReadFailedError } from './business/errors/usage-read-failed-error.js';
import { FakeUsageReader } from './testing/fake-usage-reader.js';
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
  const usageReader = new FakeUsageReader();
  const usage = createUsageModule(
    {
      database: undefined as never,
      claudeExecutablePath: '/usr/bin/claude',
      clock,
      events,
      logger: { info: () => {}, warn: () => {}, error: (message) => loggedErrors.push(message) },
    },
    { usageRepository, usageReader },
  );
  return { usage, events, clock, changed, loggedErrors, usageRepository, usageReader };
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
}

function tick(projectId = 'p1'): DomainEvents['watch.updated'] {
  return { projectId, changed: false, polledAt: '2026-10-18T12:00:00.000Z' };
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

  it('should show the read value and publish usage.changed once when watch.updated refreshes stale usage', async () => {
    const { usage, events, changed, clock, usageReader } = createSubject(
      '2026-10-18T10:30:00.000Z',
    );
    events.emit('usage.window-observed', observation());
    await settle();
    changed.length = 0;
    clock.setNow('2026-10-18T12:00:00.000Z');
    usageReader.returns({
      fiveHour: { utilizationPercent: 55, resetsAt: '2026-10-18T14:00:00.000Z' },
      sevenDay: null,
    });

    events.emit('watch.updated', tick());
    await settle();

    expect((await usage.internal.status()).fiveHour?.utilizationPercent).toBe(55);
    expect(changed).toHaveLength(1);
  });

  it('should read once when watch.updated comes for two projects while a read runs', async () => {
    const { events, usageReader } = createSubject();
    const release = usageReader.hangs();

    events.emit('watch.updated', tick('p1'));
    events.emit('watch.updated', tick('p2'));
    await settle();
    release({ fiveHour: null, sevenDay: null });
    await settle();

    expect(usageReader.reads).toBe(1);
  });

  it('should log the error and publish nothing when the read fails', async () => {
    const { events, changed, loggedErrors, usageReader } = createSubject();
    usageReader.fails(new UsageReadFailedError('sdk gone'));

    events.emit('watch.updated', tick());
    await settle();

    expect(loggedErrors).toEqual([expect.stringContaining('sdk gone')]);
    expect(changed).toHaveLength(0);
  });
});
