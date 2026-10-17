import Markdown from 'markdown-to-jsx/react';
import { memo } from 'react';
import {
  describeSessionEntry,
  describeSessionView,
  type SessionTurnDescription,
} from './describe-session-view.js';
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
          {description.turns.map((turn) => (
            <SessionTurn key={turn.id} turn={turn} opened={opened} onToggle={onToggle} />
          ))}
          {description.ended && <div className="sv-line">End of session</div>}
        </>
      )}
    </>
  );
}

function SessionTurn({
  turn,
  opened,
  onToggle,
}: {
  readonly turn: SessionTurnDescription;
  readonly opened: ReadonlySet<string>;
  readonly onToggle: (id: string) => void;
}) {
  const hasColumn = turn.entries.length > 0 || turn.openText !== undefined;
  return (
    <>
      {turn.prompt !== undefined && (
        <div className="sv-prompt">
          <div className="sv-who">App</div>
          <div className="sv-prompt-bubble">
            <Markdown>{turn.prompt.text}</Markdown>
          </div>
        </div>
      )}
      {hasColumn && (
        <div className="sv-turn">
          {turn.entries.map((entry) => (
            <SessionEntryRow
              key={entry.id}
              entry={entry}
              open={opened.has(entry.id)}
              onToggle={onToggle}
            />
          ))}
          {turn.openText !== undefined && (
            <div className="sv-bubble sv-open">
              <Markdown>{turn.openText}</Markdown>
              <span className="sv-caret" aria-hidden="true" />
            </div>
          )}
        </div>
      )}
    </>
  );
}

const SessionEntryRow = memo(function SessionEntryRow({
  entry,
  open,
  onToggle,
}: {
  readonly entry: SessionTurnDescription['entries'][number];
  readonly open: boolean;
  readonly onToggle: (id: string) => void;
}) {
  const description = describeSessionEntry(entry, open);
  switch (description.kind) {
    case 'text':
      return (
        <div className="sv-bubble">
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
