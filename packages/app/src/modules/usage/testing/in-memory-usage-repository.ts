import type { UsageWindow } from '../business/domain/types/usage-window.js';
import type { UsageRepository } from '../business/port/repository/usage-repository.js';

export class InMemoryUsageRepository implements UsageRepository {
  private stored: UsageWindow | undefined;

  async find(): Promise<UsageWindow | undefined> {
    return this.stored;
  }

  async save(window: UsageWindow): Promise<void> {
    this.stored = window;
  }
}
