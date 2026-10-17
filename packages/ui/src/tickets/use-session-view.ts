import { useEffect, useState } from 'react';
import type { LiveUpdates } from '../live/live-updates.js';
import { createSessionStream } from './create-session-stream.js';
import { initialSessionView, type SessionView } from './fold-session-view.js';

type SessionViewState = {
  readonly view: SessionView;
  readonly opened: ReadonlySet<string>;
  readonly toggle: (id: string) => void;
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

  const toggle = (id: string) =>
    setOpened((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return { view, opened, toggle };
}
