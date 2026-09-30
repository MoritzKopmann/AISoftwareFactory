import { useState } from 'react';
import { describeRunBar, type StartState } from './describe-run-bar.js';
import { RunBar } from './run-bar.js';
import { startTicketRun } from './start-ticket-run.js';
import { useTicketRun } from './use-ticket-run.js';

type RunSectionProps = {
  readonly projectId: string;
  readonly number: number;
};

export function RunSection({ projectId, number }: RunSectionProps) {
  const response = useTicketRun(projectId, number);
  const [start, setStart] = useState<StartState>({ kind: 'idle' });

  const run = async () => {
    setStart({ kind: 'starting' });
    const outcome = await startTicketRun(projectId, number, (url, requestInit) =>
      fetch(url, requestInit),
    );
    if (outcome.kind === 'failed') setStart(outcome);
  };

  return <RunBar description={describeRunBar(response, start, number)} onRun={() => void run()} />;
}
