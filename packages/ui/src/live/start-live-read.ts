import type { LiveUpdates } from './live-updates.js';
import { noticeConcernsView, type LiveView } from './notice-concerns-view.js';

export type LiveReader = { retry: () => void; stop: () => void };

/**
 * Reads now and again on a concerning notice, `opened` or `retry`. One read at a time:
 * a trigger during a read queues exactly one more, so outcomes arrive in read order.
 */
export function startLiveRead<Outcome>(
  liveUpdates: LiveUpdates,
  view: LiveView,
  read: () => Promise<Outcome>,
  onOutcome: (outcome: Outcome) => void,
): LiveReader {
  let stopped = false;
  let reading = false;
  let again = false;

  const trigger = () => {
    if (stopped) return;
    if (reading) {
      again = true;
      return;
    }
    reading = true;
    void read().then(
      (outcome) => finish(() => onOutcome(outcome)),
      () => finish(() => {}),
    );
  };

  const finish = (deliver: () => void) => {
    reading = false;
    if (stopped) return;
    deliver();
    if (again) {
      again = false;
      trigger();
    }
  };

  const unlisten = liveUpdates.listen((signal) => {
    if (signal.kind === 'opened') trigger();
    else if (signal.kind === 'notice' && noticeConcernsView(signal.notice, view)) trigger();
  });
  trigger();

  return {
    retry: trigger,
    stop: () => {
      stopped = true;
      unlisten();
    },
  };
}
