import type { KnownBugsDescription } from './describe-known-bugs.js';

export type KnownBugsTriggerDescription = { readonly label: string };

export type TriggeringKnownBugsDescription = Exclude<
  KnownBugsDescription,
  { readonly kind: 'loading' | 'empty' }
>;

export function hasKnownBugsTrigger(
  description: KnownBugsDescription,
): description is TriggeringKnownBugsDescription {
  return description.kind !== 'loading' && description.kind !== 'empty';
}

export function describeKnownBugsTrigger(
  description: TriggeringKnownBugsDescription,
): KnownBugsTriggerDescription {
  if (description.kind === 'error') {
    return { label: 'Known bugs' };
  }
  return {
    label: `${description.countLabel} known ${description.countLabel === '1' ? 'bug' : 'bugs'}`,
  };
}
