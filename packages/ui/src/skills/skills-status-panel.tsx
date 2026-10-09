import { useState } from 'react';
import { useLiveRead } from '../live/use-live-read.js';
import type { LiveUpdates } from '../live/live-updates.js';
import { Banner } from '../shared/banner.js';
import { describeSkillsStatus, type SkillsStatusResponse } from './describe-skills-status.js';
import { fetchSkillsStatus } from './fetch-skills-status.js';

export function SkillsStatusPanel({ liveUpdates }: { readonly liveUpdates: LiveUpdates }) {
  const [status, setStatus] = useState<SkillsStatusResponse | undefined>(undefined);
  const [loadFailed, setLoadFailed] = useState(false);

  const { retry } = useLiveRead(
    liveUpdates,
    { kind: 'skills' },
    () => fetchSkillsStatus((url) => fetch(url)),
    (outcome) => {
      if (outcome.kind === 'answer') {
        setStatus(outcome.status);
        setLoadFailed(false);
      } else {
        setLoadFailed(true);
      }
    },
  );

  if (loadFailed) {
    return (
      <Banner
        tone="danger"
        message="The skills status could not be loaded. Loads again on the next change, or on Retry."
        onRetry={retry}
      />
    );
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
