import { useId } from 'react';
import type { RunBarDescription } from './describe-run-bar.js';

type RunBarProps = {
  readonly description: RunBarDescription;
  readonly onRun: () => void;
};

export function RunBar({ description, onRun }: RunBarProps) {
  const reasonId = useId();
  if (description.kind === 'hidden') {
    return null;
  }
  const { button, reason, hint, announcement, error } = description;
  return (
    <div className="runbar">
      <div className="runline">
        <button
          className={button === 'run' ? 'btn primary' : 'btn'}
          type="button"
          aria-disabled={button === 'run' ? undefined : 'true'}
          aria-describedby={reason === undefined ? undefined : reasonId}
          onClick={() => {
            if (description.pressable) onRun();
          }}
        >
          {button === 'starting' ? (
            <>
              <span className="shape s-flow pulse" aria-hidden="true">
                ●
              </span>
              Starting…
            </>
          ) : (
            'Run'
          )}
        </button>
        {reason !== undefined && (
          <span className="reason" id={reasonId}>
            {reason}
          </span>
        )}
        {hint !== undefined && <span className="reason">{hint}</span>}
        {announcement !== undefined && (
          <span className="vh" role="status">
            {announcement}
          </span>
        )}
      </div>
      {error !== undefined && (
        <div className="err" role="alert">
          <span className="shape" aria-hidden="true">
            ■
          </span>
          <p>{error.message}</p>
          {error.detail !== undefined && <p className="sm mono">{error.detail}</p>}
        </div>
      )}
    </div>
  );
}
