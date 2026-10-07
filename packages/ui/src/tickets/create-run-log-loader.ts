import type { RunLogState } from './describe-run-log.js';
import type { RunLogOutcome } from './fetch-run-log.js';

export type RunLogLoader = {
  readonly toggle: (open: boolean) => Promise<void>;
  readonly retry: () => Promise<void>;
};

export function createRunLogLoader(
  read: () => Promise<RunLogOutcome>,
  show: (state: RunLogState) => void,
): RunLogLoader {
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
