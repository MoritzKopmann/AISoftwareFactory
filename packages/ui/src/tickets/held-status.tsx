type HeldStatusProps = {
  readonly heldUntilLabel?: string | undefined;
  /** What is held: "answer" for the checkpoint, "message" for the message field. */
  readonly noun?: string;
};

// The status line of a held answer. Without a known reset time it says only that the answer is held.
export function HeldStatus({ heldUntilLabel, noun = 'answer' }: HeldStatusProps) {
  return (
    <p className="held-status" role="status">
      <span className="held-mark" aria-hidden="true">
        ▲
      </span>
      <span>
        {heldUntilLabel === undefined ? (
          `Your ${noun} is held.`
        ) : (
          <>
            Your {noun} is held. It goes out at <strong>{heldUntilLabel}</strong>.
          </>
        )}
      </span>
    </p>
  );
}
