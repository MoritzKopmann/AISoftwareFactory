import type { Clock } from '../../src/shared/clock/clock.js';

export class FakeClock implements Clock {
  constructor(private currentTime: string) {}

  now(): string {
    return this.currentTime;
  }

  setNow(currentTime: string): void {
    this.currentTime = currentTime;
  }
}
