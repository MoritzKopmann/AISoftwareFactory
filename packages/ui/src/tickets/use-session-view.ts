import { useCallback, useEffect, useState } from 'react';
import type { LiveUpdates } from '../live/live-updates.js';
import { createSessionStream } from './create-session-stream.js';
import { toggleOpened } from './describe-tool-card.js';
import { initialSessionView, type SessionView } from './fold-session-view.js';

type SessionViewState = {
  readonly view: SessionView;
  readonly opened: ReadonlySet<string>;
  readonly toggle: (key: string) => void;
};

export function useSessionView(
  liveUpdates: LiveUpdates,
  projectId: string,
  number: number,
): SessionViewState {
  const [view, setView] = useState<SessionView>(initialSessionView);
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    const stream = createSessionStream({
      url: `/api/projects/${projectId}/tickets/${number}/session`,
      projectId,
      ticketNumber: number,
      openStream: (url) => new EventSource(url),
      visibility: document,
      liveUpdates,
      frames: {
        request: (callback) => requestAnimationFrame(callback),
        cancel: (handle) => cancelAnimationFrame(handle),
      },
      onChange: setView,
    });
    return () => stream.close();
  }, [liveUpdates, projectId, number]);

  const toggle = useCallback(
    (key: string) => setOpened((current) => toggleOpened(current, key)),
    [],
  );

  return { view, opened, toggle };
}
