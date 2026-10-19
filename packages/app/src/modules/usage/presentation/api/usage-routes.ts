import { Hono } from 'hono';
import type { UsageService } from '../../business/service/usage-service.js';
import { toUsageResponse } from '../dto/mapper/usage-mapper.js';

/** The module's route table, with full paths. */
export function createUsageRoutes(usageService: Pick<UsageService, 'readStatus'>): Hono {
  return new Hono().get('/api/usage', async (context) =>
    context.json(toUsageResponse(await usageService.readStatus())),
  );
}
