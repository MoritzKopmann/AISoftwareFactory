import { useState } from 'react';
import {
  describeMoveToPlanAction,
  type MoveToPlanActionDescription,
  type MoveToPlanState,
} from '../tickets/describe-move-to-plan-action.js';
import { moveTicketToPlan } from '../tickets/move-ticket-to-plan.js';

type CardMoveToPlanViewProps = {
  readonly description: MoveToPlanActionDescription;
  readonly onMove: () => void;
};

export function CardMoveToPlanView({ description, onMove }: CardMoveToPlanViewProps) {
  if (description.kind === 'hidden') {
    return null;
  }
  if (description.kind === 'done') {
    return (
      <p className="card-done" role="status">
        <span className="shape" aria-hidden="true">
          ✓
        </span>
        Moved to plan. Shows on next refresh.
      </p>
    );
  }
  const sending = description.kind === 'sending';
  return (
    <>
      <button
        className="btn"
        type="button"
        aria-disabled={sending ? 'true' : undefined}
        onClick={() => {
          if (!sending) onMove();
        }}
      >
        {sending ? (
          <>
            <span className="shape pulse" aria-hidden="true">
              ●
            </span>
            Moving…
          </>
        ) : (
          'Move to plan'
        )}
      </button>
      {description.kind === 'failed' && (
        <p className="card-err" role="alert">
          <span className="shape" aria-hidden="true">
            ■
          </span>
          <span>{description.message}</span>
        </p>
      )}
    </>
  );
}

export function CardMoveToPlanAction({
  projectId,
  number,
}: {
  readonly projectId: string;
  readonly number: number;
}) {
  const [state, setState] = useState<MoveToPlanState>({ kind: 'idle' });
  const moveNow = async () => {
    setState({ kind: 'sending' });
    const outcome = await moveTicketToPlan(projectId, number, (url, requestInit) =>
      fetch(url, requestInit),
    );
    setState(outcome.kind === 'moved' ? { kind: 'done' } : outcome);
  };
  return (
    <CardMoveToPlanView
      description={describeMoveToPlanAction('backlog', state, number)}
      onMove={() => void moveNow()}
    />
  );
}
