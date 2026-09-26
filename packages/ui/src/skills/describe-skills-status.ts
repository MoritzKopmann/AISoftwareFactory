export type SkillsStatusResponse =
  | { readonly state: 'pending' }
  | { readonly state: 'passed' }
  | { readonly state: 'failed'; readonly reason: string };

export type SkillsStatusDescription = {
  readonly headline: string;
  readonly detail?: string;
  readonly blocked: boolean;
};

export function describeSkillsStatus(status: SkillsStatusResponse): SkillsStatusDescription {
  switch (status.state) {
    case 'passed':
      return { headline: 'Skills smoke test passed', blocked: false };
    case 'failed':
      return { headline: 'Runs are blocked', detail: status.reason, blocked: true };
    case 'pending':
      return { headline: 'Skills smoke test is running', blocked: true };
  }
}
