import Markdown from 'markdown-to-jsx/react';
import { memo, useEffect, useState } from 'react';
import type { SessionEntryResponse } from '@aisf/app/api-schemas/session-stream-schemas.js';
import type { LiveUpdates } from '../live/live-updates.js';
import { createSessionStream } from './create-session-stream.js';
import { describeSessionEntry, describeSessionView } from './describe-session-view.js';
import { initialSessionView, type SessionView } from './fold-session-view.js';

type LiveSessionProps = {
  readonly liveUpdates: LiveUpdates;
  readonly projectId: string;
  readonly number: number;
};

export function LiveSession({ liveUpdates, projectId, number }: LiveSessionProps) {
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

  return (
    <SessionViewBody
      view={view}
      opened={opened}
      onToggle={(id) =>
        setOpened((current) => {
          const next = new Set(current);
          if (!next.delete(id)) next.add(id);
          return next;
        })
      }
    />
  );
}

type SessionViewBodyProps = {
  readonly view: SessionView;
  readonly opened: ReadonlySet<string>;
  readonly onToggle: (id: string) => void;
};

export function SessionViewBody({ view, opened, onToggle }: SessionViewBodyProps) {
  const description = describeSessionView(view);
  return (
    <section className="session" aria-label="Session">
      {description.kind === 'message' && (
        <p className="session-message" role="status">
          {description.message}
        </p>
      )}
      {description.kind === 'entries' && (
        <>
          {description.entries.map((entry) => (
            <SessionEntryRow
              key={entry.id}
              entry={entry}
              open={opened.has(entry.id)}
              onToggle={onToggle}
            />
          ))}
          {description.openText !== undefined && (
            <div className="session-entry session-text">
              <Markdown>{description.openText}</Markdown>
            </div>
          )}
        </>
      )}
    </section>
  );
}

const SessionEntryRow = memo(function SessionEntryRow({
  entry,
  open,
  onToggle,
}: {
  readonly entry: SessionEntryResponse;
  readonly open: boolean;
  readonly onToggle: (id: string) => void;
}) {
  const description = describeSessionEntry(entry, open);
  switch (description.kind) {
    case 'prompt':
      return (
        <div className="session-entry session-prompt">
          <Markdown>{description.text}</Markdown>
        </div>
      );
    case 'text':
      return (
        <div className="session-entry session-text">
          <Markdown>{description.text}</Markdown>
        </div>
      );
    case 'tool-call':
      return (
        <div className="session-entry session-call">
          <span className="label">{description.name}</span>
          <pre>{description.input}</pre>
        </div>
      );
    case 'tool-result':
      return (
        <div className="session-entry session-result">
          <button
            className="btn"
            type="button"
            aria-expanded={description.open}
            onClick={() => onToggle(entry.id)}
          >
            {description.label}
          </button>
          {description.parts?.map((part, position) =>
            part.kind === 'text' ? (
              <pre key={position}>{part.text}</pre>
            ) : (
              <img key={position} src={part.src} alt="" />
            ),
          )}
        </div>
      );
  }
});
