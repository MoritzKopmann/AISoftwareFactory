import { describe, expect, it } from 'vitest';
import { domainEventNames } from './event-bus.js';

describe('domainEventNames', () => {
  it('should list usage.window-observed when the event is a DomainEvent', () => {
    expect(domainEventNames).toContain('usage.window-observed');
  });
});
