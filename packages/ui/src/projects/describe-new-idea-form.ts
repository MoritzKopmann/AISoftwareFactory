import type { StartIdeaOutcome } from './start-idea-session.js';

export type NewIdeaStart =
  | { readonly kind: 'idle' }
  | { readonly kind: 'starting' }
  | Extract<StartIdeaOutcome, { kind: 'failed' }>;

export type NewIdeaFormDescription = {
  readonly pressable: boolean;
  readonly busy: boolean;
  readonly error?: {
    readonly tone: 'danger' | 'warn';
    readonly message: string;
    readonly detail?: string;
    readonly link?: { readonly label: string; readonly href: string };
  };
};

export function describeNewIdeaForm(
  text: string,
  start: NewIdeaStart,
  projectId: string,
): NewIdeaFormDescription {
  const busy = start.kind === 'starting';
  const pressable = text.trim() !== '' && !busy;
  if (start.kind !== 'failed') {
    return { pressable, busy };
  }
  if (start.ticketNumber === undefined) {
    return {
      pressable,
      busy,
      error: {
        tone: 'danger',
        message: "Couldn't create the idea. Your text is kept; submit again.",
        ...(start.message === '' ? {} : { detail: start.message }),
      },
    };
  }
  return {
    pressable,
    busy,
    error: {
      tone: 'warn',
      message: 'The idea was created, but the session did not start.',
      link: {
        label: `Open #${start.ticketNumber}`,
        href: `#/projects/${projectId}/tickets/${start.ticketNumber}`,
      },
    },
  };
}
