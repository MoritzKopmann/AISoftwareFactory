import { describe, expect, it, vi } from 'vitest';
import { TypedEventBus } from '../../../src/shared/bus/typed-event-bus.js';

type TestEvents = {
  readonly 'run.finished': { readonly runId: string };
  readonly 'snapshot.changed': { readonly repository: string };
};

describe('TypedEventBus', () => {
  describe('emit', () => {
    it('should deliver the payload to a subscriber when its event is emitted', () => {
      const bus = new TypedEventBus<TestEvents>();
      const handler = vi.fn();
      bus.on('run.finished', handler);

      bus.emit('run.finished', { runId: 'run-1' });

      expect(handler).toHaveBeenCalledExactlyOnceWith({ runId: 'run-1' });
    });

    it('should not call a subscriber when a different event is emitted', () => {
      const bus = new TypedEventBus<TestEvents>();
      const handler = vi.fn();
      bus.on('run.finished', handler);

      bus.emit('snapshot.changed', { repository: 'owner/name' });

      expect(handler).not.toHaveBeenCalled();
    });

    it('should call every subscriber in subscription order when an event has several', () => {
      const bus = new TypedEventBus<TestEvents>();
      const calls: string[] = [];
      bus.on('run.finished', () => calls.push('first'));
      bus.on('run.finished', () => calls.push('second'));

      bus.emit('run.finished', { runId: 'run-1' });

      expect(calls).toEqual(['first', 'second']);
    });

    it('should do nothing when an event has no subscribers', () => {
      const bus = new TypedEventBus<TestEvents>();

      expect(() => bus.emit('run.finished', { runId: 'run-1' })).not.toThrow();
    });
  });

  describe('on', () => {
    it('should stop delivering when the returned unsubscribe function is called', () => {
      const bus = new TypedEventBus<TestEvents>();
      const handler = vi.fn();
      const unsubscribe = bus.on('run.finished', handler);

      unsubscribe();
      bus.emit('run.finished', { runId: 'run-1' });

      expect(handler).not.toHaveBeenCalled();
    });

    it('should keep other subscribers when one unsubscribes', () => {
      const bus = new TypedEventBus<TestEvents>();
      const remaining = vi.fn();
      const unsubscribe = bus.on('run.finished', vi.fn());
      bus.on('run.finished', remaining);

      unsubscribe();
      bus.emit('run.finished', { runId: 'run-1' });

      expect(remaining).toHaveBeenCalledOnce();
    });

    it('should deliver to a subscriber added during emit only on the next emit', () => {
      const bus = new TypedEventBus<TestEvents>();
      const late = vi.fn();
      bus.on('run.finished', () => bus.on('run.finished', late));

      bus.emit('run.finished', { runId: 'run-1' });
      expect(late).not.toHaveBeenCalled();

      bus.emit('run.finished', { runId: 'run-2' });
      expect(late).toHaveBeenCalledOnce();
    });
  });
});
