import type { SkillsStatusResponse } from './describe-skills-status.js';

export type SkillsStatusOutcome =
  | { readonly kind: 'answer'; readonly status: SkillsStatusResponse }
  | { readonly kind: 'request-failed' };

export async function fetchSkillsStatus(
  request: (url: string) => Promise<Response>,
): Promise<SkillsStatusOutcome> {
  try {
    const response = await request('/api/skills/status');
    if (!response.ok) return { kind: 'request-failed' };
    return { kind: 'answer', status: (await response.json()) as SkillsStatusResponse };
  } catch {
    return { kind: 'request-failed' };
  }
}
