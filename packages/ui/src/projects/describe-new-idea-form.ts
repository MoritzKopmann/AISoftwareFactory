import type { StartIdeaOutcome } from './start-idea-session.js';

export type NewIdeaStart =
  | { readonly kind: 'idle' }
  | { readonly kind: 'starting' }
  | Extract<StartIdeaOutcome, { kind: 'failed' }>;

export type NewIdeaFormDescription = {
  readonly pressable: boolean;
  readonly error?: {
    readonly message: string;
    readonly link?: { readonly label: string; readonly href: string };
  };
};

export function describeNewIdeaForm(
  title: string,
  start: NewIdeaStart,
  projectId: string,
): NewIdeaFormDescription {
  const pressable = title.trim() !== '' && start.kind !== 'starting';
  if (start.kind !== 'failed') {
    return { pressable };
  }
  return {
    pressable,
    error: {
      message: start.message,
      ...(start.ticketNumber === undefined
        ? {}
        : {
            link: {
              label: `#${start.ticketNumber}`,
              href: `#/projects/${projectId}/tickets/${start.ticketNumber}`,
            },
          }),
    },
  };
}
