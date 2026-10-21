import type { OnboardingStart } from './describe-start-onboarding.js';
import { startOnboarding } from './start-onboarding.js';

export async function pressStartOnboarding(
  start: OnboardingStart,
  projectId: string,
  dependencies: {
    readonly request: (url: string, requestInit: RequestInit) => Promise<Response>;
    readonly setStart: (start: OnboardingStart) => void;
    readonly navigate: (hash: string) => void;
  },
): Promise<void> {
  if (start.kind === 'starting') return;
  dependencies.setStart({ kind: 'starting' });
  const outcome = await startOnboarding(projectId, dependencies.request);
  if (outcome.kind === 'started') {
    dependencies.navigate(`#/projects/${projectId}/tickets/${outcome.ticketNumber}`);
    return;
  }
  dependencies.setStart(outcome);
}
