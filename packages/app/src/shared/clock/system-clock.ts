import type { Clock } from './clock.js';

export class SystemClock implements Clock {
  now(): string {
    return new Date().toISOString();
  }
}
