import { useId, useLayoutEffect, useRef, useState } from 'react';
import type {
  PermissionDecision,
  PermissionPromptDescription,
} from './describe-permission-prompt.js';

type PermissionPromptProps = {
  readonly description: PermissionPromptDescription;
  readonly onAnswer: (decision: PermissionDecision) => void;
};

function ToolInput({ text }: { readonly text: string }) {
  const inputRef = useRef<HTMLPreElement>(null);
  const [scrollable, setScrollable] = useState(false);

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (input === null) {
      return;
    }
    const measure = () => {
      setScrollable(input.scrollHeight > input.clientHeight);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(input);
    return () => {
      observer.disconnect();
    };
  }, [text]);

  return (
    <pre
      ref={inputRef}
      className="input"
      tabIndex={scrollable ? 0 : undefined}
      aria-label={scrollable ? 'Tool input, scrollable' : undefined}
    >
      {text}
    </pre>
  );
}

const decisionLabels: Readonly<Record<PermissionDecision, string>> = {
  allow: 'Allow',
  deny: 'Deny',
};

export function PermissionPrompt({ description, onAnswer }: PermissionPromptProps) {
  const headingId = useId();
  if (description.kind === 'hidden') {
    return null;
  }
  const { toolName, inputText, reason, guidance, pressable, resuming, announcement, error } =
    description;
  const answerButton = (decision: PermissionDecision) => (
    <button
      className={decision === 'allow' ? 'btn primary' : 'btn'}
      type="button"
      aria-disabled={pressable ? undefined : 'true'}
      onClick={() => {
        if (pressable) onAnswer(decision);
      }}
    >
      {resuming === decision ? (
        <>
          <span className="shape pulse" aria-hidden="true">
            ●
          </span>
          Resuming…
        </>
      ) : (
        decisionLabels[decision]
      )}
    </button>
  );
  return (
    <section className="perm" aria-labelledby={headingId}>
      <h2 id={headingId}>Waiting for your permission</h2>
      {guidance && (
        <p className="sm explainer">
          The run stopped before this tool call. Your answer resumes the same session.
        </p>
      )}
      <div className="call">
        <div className="callhead">
          <span className="label">Tool</span>
          <span className="chip">{toolName}</span>
        </div>
        <ToolInput text={inputText} />
      </div>
      {reason !== undefined && <p className="sm">{`Reason: ${reason}`}</p>}
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
        {answerButton('allow')}
        {answerButton('deny')}
        {announcement !== undefined && (
          <span className="vh" role="status">
            {announcement}
          </span>
        )}
      </div>
      {guidance && (
        <div className="hints">
          <p className="sm">Allow lets this exact call run once.</p>
          <p className="sm">Deny tells the session you refused it.</p>
        </div>
      )}
    </section>
  );
}
