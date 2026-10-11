import type { StopActionDescription } from './describe-stop-action.js';

type StopButtonProps = {
  readonly stop: StopActionDescription;
  readonly onStop: () => void;
};

export function StopButton({ stop, onStop }: StopButtonProps) {
  return (
    <>
      <button
        className="btn stop"
        type="button"
        aria-disabled={stop.pressable ? undefined : 'true'}
        onClick={() => {
          if (stop.pressable) onStop();
        }}
      >
        {stop.label}
      </button>
      {stop.announcement !== undefined && (
        <span className="vh" role="status">
          {stop.announcement}
        </span>
      )}
    </>
  );
}
