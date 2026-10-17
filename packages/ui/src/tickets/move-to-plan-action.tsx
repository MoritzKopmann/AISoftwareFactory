import type { MoveToPlanActionDescription } from './describe-move-to-plan-action.js';

type MoveToPlanActionProps = {
  readonly description: MoveToPlanActionDescription;
  readonly onMove: () => void;
};

export function MoveToPlanAction({ description, onMove }: MoveToPlanActionProps) {
  if (description.kind === 'hidden') {
    return null;
  }
  const sending = description.kind === 'sending';
  return (
    <section className="move-to-plan" aria-label="Move to plan">
      {description.kind === 'done' ? (
        <p className="done-line" role="status">
          <span className="shape" aria-hidden="true">
            ✓
          </span>
          Moved to plan. The status shows plan after the next refresh.
        </p>
      ) : (
        <>
          <button
            className="btn primary"
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
                Moving to plan…
              </>
            ) : (
              'Move to plan'
            )}
          </button>
          <p className="reason">Sets the ticket&apos;s status to plan.</p>
          {description.kind === 'failed' && (
            <div className="err" role="alert">
              <span className="shape" aria-hidden="true">
                ■
              </span>
              <p>{description.message}</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
