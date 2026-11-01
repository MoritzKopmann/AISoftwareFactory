import type { FormEvent } from 'react';
import { checkpointAnswerCharacterLimit } from './checkpoint-answer-character-limit.js';
import { groupThousands } from './describe-checkpoint-prompt.js';
import { HeldStatus } from './held-status.js';

const lineHeightPx = 48;
const maxHeightPx = 240;

export type MessageFieldError = {
  readonly message: string;
  /** The status code, shown under the message. Absent for a network failure. */
  readonly status?: string;
};

export type MessageFieldProps = {
  readonly draft: string;
  readonly pressable: boolean;
  readonly sending: boolean;
  readonly noActiveRun: boolean;
  readonly error?: MessageFieldError;
  readonly held?: { readonly heldUntilLabel?: string };
  readonly onDraftChange: (draft: string) => void;
  readonly onSend: () => void;
};

const inputId = 'message-field-input';
const hintId = 'message-field-hint';

// The view of the session panel's message field. State arrives as props; nothing is fetched.
export function MessageField({
  draft,
  pressable,
  sending,
  noActiveRun,
  error,
  held,
  onDraftChange,
  onSend,
}: MessageFieldProps) {
  const atLimit = draft.length >= checkpointAnswerCharacterLimit;
  const press = (event: FormEvent) => {
    event.preventDefault();
    if (pressable) onSend();
  };
  return (
    <form className="mf">
      {error !== undefined && (
        <div className="err" role="alert">
          <span className="shape" aria-hidden="true">
            ■
          </span>
          <p>{`Couldn't send your message. ${error.message}`.trimEnd()}</p>
          {error.status !== undefined && <p className="sm mono">{error.status}</p>}
        </div>
      )}
      {held !== undefined && <HeldStatus noun="message" heldUntilLabel={held.heldUntilLabel} />}
      <label className="vh" htmlFor={inputId}>
        Message to the agent
      </label>
      <div className="mf-row">
        <textarea
          id={inputId}
          ref={(element) => {
            fitHeight(element);
          }}
          className={atLimit ? 'over' : undefined}
          rows={1}
          maxLength={checkpointAnswerCharacterLimit}
          placeholder={noActiveRun ? 'No active run' : 'Message the agent'}
          aria-describedby={hintId}
          value={draft}
          readOnly={sending}
          disabled={noActiveRun}
          onChange={(event) => {
            onDraftChange(event.target.value);
          }}
        />
        <button
          className="btn primary"
          type="submit"
          aria-disabled={pressable ? undefined : 'true'}
          onClick={press}
        >
          {sending ? (
            <>
              <span className="shape pulse" aria-hidden="true">
                ●
              </span>
              Sending…
            </>
          ) : (
            'Send'
          )}
        </button>
      </div>
      <div className="mf-foot">
        <span className={atLimit ? 'sm hint at' : 'sm hint'} id={hintId}>
          {describeHint(noActiveRun, atLimit)}
        </span>
        {!noActiveRun && (
          <span className={atLimit ? 'count at' : 'count'}>
            {`${groupThousands(draft.length)} / ${groupThousands(checkpointAnswerCharacterLimit)}`}
          </span>
        )}
      </div>
      {sending && (
        <span className="vh" role="status">
          Sending your message
        </span>
      )}
    </form>
  );
}

function describeHint(noActiveRun: boolean, atLimit: boolean): string {
  if (noActiveRun) return 'No active run. Messages go to a running agent.';
  if (atLimit) return 'Limit reached. Shorten the message to add more.';
  return 'The agent reads it at its next step. The run goes on.';
}

// One line is 48px; the field grows with its text up to 240px, then scrolls.
function fitHeight(textarea: HTMLTextAreaElement | null): void {
  if (textarea === null) return;
  textarea.style.height = 'auto';
  const height = Math.min(Math.max(textarea.scrollHeight, lineHeightPx), maxHeightPx);
  textarea.style.height = `${height}px`;
}
