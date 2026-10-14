export type SkillsStatusDto =
  | { readonly state: 'pending' }
  | { readonly state: 'passed' }
  | { readonly state: 'failed'; readonly reason: string };
