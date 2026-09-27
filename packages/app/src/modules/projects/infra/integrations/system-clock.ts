import type { Clock } from '../../logic/ports/clock.js';

export class SystemClock implements Clock {
  now(): string {
    return new Date().toISOString();
  }
}
