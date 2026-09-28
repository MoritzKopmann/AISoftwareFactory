export type SkillsStatusResponse =
  | { readonly state: 'pending' }
  | { readonly state: 'passed' }
  | { readonly state: 'failed'; readonly reason: string };

export type SkillsBannerDescription = {
  readonly tone: 'info' | 'danger';
  readonly message: string;
  readonly detail?: string;
  readonly pulses: boolean;
};

export function describeSkillsStatus(
  status: SkillsStatusResponse,
): SkillsBannerDescription | undefined {
  switch (status.state) {
    case 'passed':
      return undefined;
    case 'failed':
      return {
        tone: 'danger',
        message: 'Runs are blocked.',
        detail: status.reason,
        pulses: false,
      };
    case 'pending':
      return {
        tone: 'info',
        message: 'Checking the skills. Runs start once the smoke test passes.',
        pulses: true,
      };
  }
}
