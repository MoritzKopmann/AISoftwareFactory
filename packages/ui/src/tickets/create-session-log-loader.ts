import type { SessionLogState } from './describe-session-log.js';
import type { SessionLogOutcome } from './fetch-session-log.js';

export type SessionLogLoader = {
  readonly toggle: (open: boolean) => Promise<void>;
  readonly retry: () => Promise<void>;
};

export function createSessionLogLoader(
  read: () => Promise<SessionLogOutcome>,
  show: (state: SessionLogState) => void,
): SessionLogLoader {
  let latestRequestNumber = 0;

  const load = async () => {
    latestRequestNumber += 1;
    const requestNumber = latestRequestNumber;
    show({ kind: 'loading' });
    const outcome = await read();
    if (requestNumber === latestRequestNumber) show(outcome);
  };

  return {
    toggle: async (open) => {
      if (open) {
        await load();
      } else {
        latestRequestNumber += 1;
        show({ kind: 'closed' });
      }
    },
    retry: load,
  };
}
