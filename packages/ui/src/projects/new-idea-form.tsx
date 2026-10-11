import { useState } from 'react';
import {
  describeNewIdeaForm,
  type NewIdeaFormDescription,
  type NewIdeaStart,
} from './describe-new-idea-form.js';
import { startIdeaSession } from './start-idea-session.js';

export function NewIdeaForm({ projectId }: { readonly projectId: string }) {
  const [text, setText] = useState('');
  const [start, setStart] = useState<NewIdeaStart>({ kind: 'idle' });
  const description = describeNewIdeaForm(text, start, projectId);

  const submit = async () => {
    if (!description.pressable) return;
    setStart({ kind: 'starting' });
    const outcome = await startIdeaSession(projectId, text, (url, requestInit) =>
      fetch(url, requestInit),
    );
    if (outcome.kind === 'started') {
      window.location.hash = `#/projects/${projectId}/tickets/${outcome.ticketNumber}`;
      return;
    }
    if (outcome.ticketNumber !== undefined) setText('');
    setStart(outcome);
  };

  return (
    <NewIdeaFormView
      text={text}
      description={description}
      onTextChange={setText}
      onSubmit={() => void submit()}
    />
  );
}

export function NewIdeaFormView({
  text,
  description,
  onTextChange,
  onSubmit,
}: {
  readonly text: string;
  readonly description: NewIdeaFormDescription;
  readonly onTextChange: (text: string) => void;
  readonly onSubmit: () => void;
}) {
  const { busy, error } = description;
  return (
    <form
      className="idea-form"
      aria-busy={busy ? 'true' : undefined}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label>
        <span className="label">New idea</span>
        <textarea
          rows={3}
          placeholder="What should exist? Add as much detail as you like."
          value={text}
          readOnly={busy}
          onChange={(event) => onTextChange(event.target.value)}
        />
        <span className="sm">The first line becomes the title.</span>
      </label>
      <button
        className={busy ? 'btn' : 'btn primary'}
        type="submit"
        aria-disabled={busy ? 'true' : undefined}
      >
        {busy ? (
          <>
            <span className="shape s-flow" aria-hidden="true">
              ●
            </span>
            Creating…
          </>
        ) : (
          '+ New idea'
        )}
      </button>
      {error !== undefined && (
        <div className={error.tone === 'warn' ? 'err warn' : 'err'} role="alert">
          <span className={`shape s-${error.tone}`} aria-hidden="true">
            {error.tone === 'warn' ? '▲' : '■'}
          </span>
          <p>{error.message}</p>
          {error.detail !== undefined && <p className="sm mono">{error.detail}</p>}
          {error.link !== undefined && <a href={error.link.href}>{error.link.label}</a>}
        </div>
      )}
    </form>
  );
}
