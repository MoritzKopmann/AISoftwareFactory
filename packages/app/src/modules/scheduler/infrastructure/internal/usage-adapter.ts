import type { UsageApi } from '../../../usage/index.js';
import type { UsagePort } from '../../business/port/usage/usage-port.js';

export class UsageAdapter implements UsagePort {
  constructor(private readonly usage: Pick<UsageApi, 'status'>) {}

  async pausedUntil(): Promise<string | undefined> {
    const { pausedUntil } = await this.usage.status();
    return pausedUntil ?? undefined;
  }
}
