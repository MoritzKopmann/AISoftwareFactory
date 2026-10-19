type HeldStatusProps = {
  readonly heldUntilLabel?: string | undefined;
};

// The status line of a held answer. Without a known reset time it says only that the answer is held.
export function HeldStatus({ heldUntilLabel }: HeldStatusProps) {
  return (
    <p className="held-status" role="status">
      <span className="held-mark" aria-hidden="true">
        ▲
      </span>
      <span>
        {heldUntilLabel === undefined ? (
          'Your answer is held.'
        ) : (
          <>
            Your answer is held. It goes out at <strong>{heldUntilLabel}</strong>.
          </>
        )}
      </span>
    </p>
  );
}
