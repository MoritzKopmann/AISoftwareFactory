import { useState } from 'react';
import type { ProjectResponse } from '@aisf/app/api-schemas/projects-schemas.js';
import { describeAddProjectFailure } from './describe-add-project-failure.js';

type AddProjectFormProps = {
  readonly onAdded: (project: ProjectResponse) => void;
};

export function AddProjectForm({ onAdded }: AddProjectFormProps) {
  const [checkoutPath, setCheckoutPath] = useState('');
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setErrorMessage(undefined);

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkoutPath }),
      });
      const body = await response.json().catch(() => undefined);
      if (!response.ok) {
        setErrorMessage(describeAddProjectFailure(response.status, body));
        return;
      }
      onAdded(body as ProjectResponse);
    } catch {
      setErrorMessage(describeAddProjectFailure(undefined, undefined));
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={(event) => void handleSubmit(event)}>
      <label htmlFor="checkout-path">Absolute path of the checkout</label>
      <input
        id="checkout-path"
        type="text"
        value={checkoutPath}
        disabled={pending}
        onChange={(event) => setCheckoutPath(event.target.value)}
      />
      <button type="submit" disabled={pending}>
        Add project
      </button>
      {pending && (
        <p className="muted">Adding… labels and plugin install can take up to a minute.</p>
      )}
      {errorMessage !== undefined && <p role="alert">{errorMessage}</p>}
    </form>
  );
}
