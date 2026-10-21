import type { StartOnboardingOutcome } from './start-onboarding.js';

export type OnboardingStart =
  | { readonly kind: 'idle' }
  | { readonly kind: 'starting' }
  | Exclude<StartOnboardingOutcome, { kind: 'started' }>;

export type StartOnboardingDescription = {
  readonly isBusy: boolean;
  readonly error?: {
    readonly tone: 'danger' | 'warn';
    readonly message: string;
    readonly detail?: string;
  };
};

export function describeStartOnboarding(start: OnboardingStart): StartOnboardingDescription {
  const isBusy = start.kind === 'starting';
  if (start.kind === 'conflict') {
    return {
      isBusy,
      error: {
        tone: 'warn',
        message: 'Onboarding already started or done. Reload the page to see it.',
      },
    };
  }
  if (start.kind === 'failed') {
    return {
      isBusy,
      error: {
        tone: 'danger',
        message: "Couldn't start onboarding.",
        ...(start.message === '' ? {} : { detail: start.message }),
      },
    };
  }
  if (start.kind === 'unreachable') {
    return {
      isBusy,
      error: { tone: 'danger', message: "Can't reach aisf. Press Start onboarding to try again." },
    };
  }
  return { isBusy };
}
