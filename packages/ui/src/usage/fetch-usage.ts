import type { UsageResponse } from '@aisf/app/api-schemas/usage-schemas.js';
import { isRequestFailure } from '../shared/is-request-failure.js';

export type UsageOutcome =
  { readonly kind: 'answer'; readonly usage: UsageResponse } | { readonly kind: 'request-failed' };

export async function fetchUsage(
  request: (url: string) => Promise<Response>,
): Promise<UsageOutcome> {
  try {
    const response = await request('/api/usage');
    if (!response.ok) return { kind: 'request-failed' };
    return { kind: 'answer', usage: (await response.json()) as UsageResponse };
  } catch (error) {
    if (!isRequestFailure(error)) throw error;
    return { kind: 'request-failed' };
  }
}
