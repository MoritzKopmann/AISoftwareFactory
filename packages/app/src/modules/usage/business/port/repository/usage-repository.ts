import type { UsageWindow } from '../../domain/types/usage-window.js';

export interface UsageRepository {
  find(): Promise<UsageWindow | undefined>;
  save(window: UsageWindow): Promise<void>;
}
