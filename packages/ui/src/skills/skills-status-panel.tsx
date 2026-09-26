import { useEffect, useState } from 'react';
import { describeSkillsStatus, type SkillsStatusResponse } from './describe-skills-status.js';

const pollIntervalMilliseconds = 2000;

export function SkillsStatusPanel() {
  const [status, setStatus] = useState<SkillsStatusResponse | undefined>(undefined);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const load = async () => {
      try {
        const response = await fetch('/api/skills/status');
        if (!response.ok) {
          throw new Error(`Status route answered ${response.status}`);
        }
        const loaded = (await response.json()) as SkillsStatusResponse;
        if (cancelled) return;
        setStatus(loaded);
        setLoadFailed(false);
        if (loaded.state === 'pending') {
          timer = setTimeout(() => void load(), pollIntervalMilliseconds);
        }
      } catch {
        if (!cancelled) setLoadFailed(true);
      }
    };
    void load();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  if (loadFailed) {
    return <p role="alert">The skills status could not be loaded.</p>;
  }
  if (status === undefined) {
    return <p role="status">Loading the skills status…</p>;
  }

  const description = describeSkillsStatus(status);
  return (
    <section role={status.state === 'failed' ? 'alert' : 'status'}>
      <h2>{description.headline}</h2>
      {description.detail !== undefined && <p>{description.detail}</p>}
    </section>
  );
}
