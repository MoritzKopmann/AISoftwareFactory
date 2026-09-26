export type SmokeTestResult =
  { readonly state: 'passed' } | { readonly state: 'failed'; readonly reason: string };

export type SkillsStatus = { readonly state: 'pending' } | SmokeTestResult;

export type RunsBlocked =
  { readonly blocked: false } | { readonly blocked: true; readonly reason: string };
