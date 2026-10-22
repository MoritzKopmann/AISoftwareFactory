export type SessionToggleView = {
  readonly label: string;
  readonly expanded: boolean;
};

export function describeSessionToggle(shown: boolean): SessionToggleView {
  return { label: shown ? 'Hide session' : 'Show session', expanded: shown };
}
