import type { UsageStatusDto } from '../dto/internal/usage-status-dto.js';

/** What other modules may ask of usage. */
export interface UsageApi {
  status(): Promise<UsageStatusDto>;
}
