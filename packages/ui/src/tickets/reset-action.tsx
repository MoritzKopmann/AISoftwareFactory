import type { ResetActionDescription } from './describe-reset-action.js';

type ResetActionProps = {
  readonly description: ResetActionDescription;
  readonly onReset: () => void;
};

export function ResetAction({ description, onReset }: ResetActionProps) {
  if (description.kind === 'hidden') {
    return null;
  }
  const { resetting, announcement, error } = description;
  return (
    <section className="reset" aria-label="Reset">
      <div className="runline">
        <button
          className="btn"
          type="button"
          aria-disabled={resetting ? 'true' : undefined}
          onClick={() => {
            if (!resetting) onReset();
          }}
        >
          {resetting ? (
            <>
              <span className="shape pulse" aria-hidden="true">
                ●
              </span>
              Resetting…
            </>
          ) : (
            'Reset to ready'
          )}
        </button>
        {announcement !== undefined && (
          <span className="vh" role="status">
            {announcement}
          </span>
        )}
      </div>
      <p className="reason">
        Puts the ticket back to ready. The worktree and its unsaved work are kept; Run then starts a
        new session.
      </p>
      {error !== undefined && (
        <div className="err" role="alert">
          <span className="shape" aria-hidden="true">
            ■
          </span>
          <p>{error.message}</p>
          {error.detail !== undefined && <p className="sm mono">{error.detail}</p>}
        </div>
      )}
    </section>
  );
}
