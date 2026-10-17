import Markdown from 'markdown-to-jsx/react';
import { memo } from 'react';
import type { SessionEntryResponse } from '@aisf/app/api-schemas/session-stream-schemas.js';
import { describeSessionEntry, describeSessionView } from './describe-session-view.js';
import type { SessionView } from './fold-session-view.js';

type SessionViewBodyProps = {
  readonly view: SessionView;
  readonly opened: ReadonlySet<string>;
  readonly onToggle: (id: string) => void;
};

export function SessionViewBody({ view, opened, onToggle }: SessionViewBodyProps) {
  const description = describeSessionView(view);
  return (
    <>
      {description.kind === 'loading' && (
        <>
          <div className="sv-skel sv-skel-right pulse" aria-hidden="true" />
          <div className="sv-skel sv-skel-left sv-skel-wide pulse" aria-hidden="true" />
          <div className="sv-skel sv-skel-left sv-skel-narrow pulse" aria-hidden="true" />
          <p className="sm sv-caption pulse" role="status">
            {description.caption}
          </p>
        </>
      )}
      {description.kind === 'system-line' && (
        <div className="sv-line" role="status">
          {description.message}
        </div>
      )}
      {description.kind === 'transcript-not-found' && (
        <div className="sv-missing" role="status">
          <p className="sv-missing-title">
            <span aria-hidden="true">▲ </span>
            {description.title}
          </p>
          <p className="sm">{description.detail}</p>
        </div>
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
          {description.ended && <div className="sv-line">End of session</div>}
        </>
      )}
    </>
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
