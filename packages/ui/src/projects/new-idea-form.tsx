import { useState } from 'react';
import { describeNewIdeaForm, type NewIdeaStart } from './describe-new-idea-form.js';
import { startIdeaSession } from './start-idea-session.js';

export function NewIdeaForm({ projectId }: { readonly projectId: string }) {
  const [title, setTitle] = useState('');
  const [start, setStart] = useState<NewIdeaStart>({ kind: 'idle' });
  const description = describeNewIdeaForm(title, start, projectId);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!description.pressable) return;
    setStart({ kind: 'starting' });
    const outcome = await startIdeaSession(projectId, title, (url, requestInit) =>
      fetch(url, requestInit),
    );
    if (outcome.kind === 'started') {
      window.location.hash = `#/projects/${projectId}/tickets/${outcome.ticketNumber}`;
    } else {
      setStart(outcome);
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)}>
      <label htmlFor="new-idea-title">New idea</label>
      <input
        id="new-idea-title"
        type="text"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <button
        className="btn"
        type="submit"
        aria-disabled={description.pressable ? undefined : 'true'}
      >
        + New idea
      </button>
      {description.error !== undefined && (
        <p role="alert">
          {description.error.message}
          {description.error.link !== undefined && (
            <>
              {' '}
              <a href={description.error.link.href}>{description.error.link.label}</a>
            </>
          )}
        </p>
      )}
    </form>
  );
}
