import type { UsageService } from '../../business/service/usage-service.js';
import type { UsageStatusDto } from '../dto/internal/usage-status-dto.js';
import { toUsageStatusDto } from '../dto/mapper/usage-mapper.js';
import type { UsageApi } from './usage-api.js';

export class UsageFacade implements UsageApi {
  constructor(private readonly usageService: Pick<UsageService, 'readStatus'>) {}

  async status(): Promise<UsageStatusDto> {
    return toUsageStatusDto(await this.usageService.readStatus());
  }
}
