import { useEffect, useState } from 'react';
import { Banner } from '../shared/banner.js';
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
    return <Banner tone="danger" message="The skills status could not be loaded." />;
  }
  if (status === undefined) {
    return null;
  }

  const description = describeSkillsStatus(status);
  if (description === undefined) {
    return null;
  }
  return (
    <Banner
      tone={description.tone}
      message={description.message}
      pulses={description.pulses}
      {...(description.detail !== undefined && { detail: description.detail })}
    />
  );
}
