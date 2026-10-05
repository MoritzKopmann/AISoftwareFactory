import { useId, useLayoutEffect, useRef, useState } from 'react';
import { checkpointAnswerCharacterLimit } from './checkpoint-answer-character-limit.js';
import type { CheckpointPromptDescription } from './describe-checkpoint-prompt.js';

type CheckpointPromptProps = {
  readonly description: CheckpointPromptDescription;
  readonly onDraftChange: (draft: string) => void;
  readonly onSend: () => void;
};

function CheckpointRequest({ text }: { readonly text: string }) {
  const requestRef = useRef<HTMLPreElement>(null);
  const [scrollable, setScrollable] = useState(false);

  useLayoutEffect(() => {
    const request = requestRef.current;
    if (request === null) {
      return;
    }
    const measure = () => {
      setScrollable(request.scrollHeight > request.clientHeight);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(request);
    return () => {
      observer.disconnect();
    };
  }, [text]);

  return (
    <pre
      ref={requestRef}
      className="request"
      tabIndex={scrollable ? 0 : undefined}
      aria-label={scrollable ? 'Request, scrollable' : undefined}
    >
      {text}
    </pre>
  );
}

export function CheckpointPrompt({ description, onDraftChange, onSend }: CheckpointPromptProps) {
  const headingId = useId();
  const answerId = useId();
  if (description.kind === 'hidden') {
    return null;
  }
  const {
    request,
    draft,
    counterText,
    hint,
    atLimit,
    sending,
    pressable,
    reason,
    announcement,
    error,
  } = description;
  return (
    <section className="ckpt" aria-labelledby={headingId}>
      <h2 id={headingId}>Waiting for your answer</h2>
      <p className="sm explainer">
        The session stopped to ask you this. Your answer resumes the same session.
      </p>
      <div className="field">
        <span className="label">Request</span>
        <CheckpointRequest text={request} />
      </div>
      <div className="field">
        <label className="label" htmlFor={answerId}>
          Your answer
        </label>
        <textarea
          id={answerId}
          className={atLimit ? 'answer over' : 'answer'}
          maxLength={checkpointAnswerCharacterLimit}
          value={draft}
          readOnly={sending}
          onChange={(event) => {
            onDraftChange(event.target.value);
          }}
        />
        <div className="fieldfoot">
          <span className={atLimit ? 'sm hint at' : 'sm hint'}>{hint}</span>
          <span className={atLimit ? 'count at' : 'count'}>{counterText}</span>
        </div>
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
      <div className="actions">
        <button
          className="btn primary"
          type="button"
          aria-disabled={pressable ? undefined : 'true'}
          onClick={() => {
            if (pressable) onSend();
          }}
        >
          {sending ? (
            <>
              <span className="shape pulse" aria-hidden="true">
                ●
              </span>
              Resuming…
            </>
          ) : (
            'Send'
          )}
        </button>
        {reason !== undefined && <span className="reason">{reason}</span>}
        {announcement !== undefined && (
          <span className="vh" role="status">
            {announcement}
          </span>
        )}
      </div>
    </section>
  );
}
