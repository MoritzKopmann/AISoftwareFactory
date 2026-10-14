import { describe, expect, it } from 'vitest';
import { InMemoryEventBus } from '../../shared/in-memory-event-bus.js';
import type { DomainEvents } from '../../shared/event-bus.js';
import { createLiveModule } from './index.js';

describe('createLiveModule', () => {
  it('should serve the live-notice stream when the module is wired through its index', async () => {
    const live = createLiveModule({ events: new InMemoryEventBus<DomainEvents>() });

    const response = await live.routes.request('/events');
    await response.body?.cancel();

    expect(response.headers.get('content-type')).toContain('text/event-stream');
    expect(live.jobs).toEqual({});
  });
});
