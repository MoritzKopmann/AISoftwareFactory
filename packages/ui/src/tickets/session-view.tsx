import Markdown from 'markdown-to-jsx/react';
import { memo } from 'react';
import { describeSessionView, type SessionTurnDescription } from './describe-session-view.js';
import {
  describeResultParts,
  describeToolHeader,
  describeToolInput,
  describeToolRow,
  toolKeys,
  type ToolStatus,
  type ToolCallEntry,
  type ToolCardEntries,
  type ToolResultEntry,
} from './describe-tool-card.js';
import type { SessionView } from './fold-session-view.js';

type SessionViewBodyProps = {
  readonly view: SessionView;
  readonly opened: ReadonlySet<string>;
  readonly onToggle: (key: string) => void;
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
            <SessionTurn
              key={turn.id}
              turn={turn}
              live={!description.ended}
              opened={opened}
              onToggle={onToggle}
            />
          ))}
          {description.ended && <div className="sv-line">End of session</div>}
        </>
      )}
    </>
  );
}

function SessionTurn({
  turn,
  live,
  opened,
  onToggle,
}: {
  readonly turn: SessionTurnDescription;
  readonly live: boolean;
  readonly opened: ReadonlySet<string>;
  readonly onToggle: (key: string) => void;
}) {
  const hasColumn = turn.items.length > 0 || turn.openText !== undefined;
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
          {turn.items.map((item) =>
            item.kind === 'text' ? (
              <div key={item.entry.id} className="sv-bubble">
                <Markdown>{item.entry.text}</Markdown>
              </div>
            ) : (
              <ToolCard
                key={item.card.id}
                card={item.card}
                live={live}
                opened={opened}
                onToggle={onToggle}
              />
            ),
          )}
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

function ToolCard({
  card,
  live,
  opened,
  onToggle,
}: {
  readonly card: ToolCardEntries;
  readonly live: boolean;
  readonly opened: ReadonlySet<string>;
  readonly onToggle: (key: string) => void;
}) {
  const header = describeToolHeader(card, live);
  return (
    <div className="tc">
      {header !== undefined && (
        <div className="tc-head">
          <span className={`tc-tag tc-${header.tag.colour}`}>{header.tag.name}</span>
          <span className="tc-count">{`×${header.count}`}</span>
          <span className="tc-grow" />
          {header.done > 0 && <span>{`${header.done} done`}</span>}
          {header.running > 0 && (
            <>
              <ToolStatusMark status="running" />
              <span>{`${header.running} running`}</span>
            </>
          )}
          {header.failed > 0 && (
            <span className="tc-failed">
              <span aria-hidden="true">▲</span>
              {` ${header.failed} failed`}
            </span>
          )}
        </div>
      )}
      {card.calls.map(({ call, result }) => (
        <ToolRow
          key={call.id}
          call={call}
          result={result}
          live={live}
          grouped={header !== undefined}
          inputOpen={opened.has(toolKeys(call.id).input)}
          resultOpen={opened.has(toolKeys(call.id).result)}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}

const ToolRow = memo(function ToolRow({
  call,
  result,
  live,
  grouped,
  inputOpen,
  resultOpen,
  onToggle,
}: {
  readonly call: ToolCallEntry;
  readonly result: ToolResultEntry | undefined;
  readonly live: boolean;
  readonly grouped: boolean;
  readonly inputOpen: boolean;
  readonly resultOpen: boolean;
  readonly onToggle: (key: string) => void;
}) {
  const row = describeToolRow(call, result, live);
  const chevron = (open: boolean) => (open ? '▾' : '▸');
  return (
    <div className="tc-row">
      <div className="tc-top">
        <ToolStatusMark status={row.status} />
        {!grouped && <span className={`tc-tag tc-${row.tag.colour}`}>{row.tag.name}</span>}
        <span className={row.headline?.mono === false ? 'tc-hl' : 'tc-hl tc-mono'}>
          {row.headline?.text}
        </span>
        <button
          className="tc-toggle"
          type="button"
          aria-expanded={inputOpen}
          onClick={() => onToggle(row.inputKey)}
        >
          {`input ${chevron(inputOpen)}`}
        </button>
        {row.resultToggle !== undefined && (
          <button
            className={row.resultToggle.error ? 'tc-toggle tc-toggle-error' : 'tc-toggle'}
            type="button"
            aria-expanded={resultOpen}
            onClick={() => onToggle(row.resultKey)}
          >
            {`${row.resultToggle.label} `}
            {row.resultToggle.size !== undefined && (
              <span className="tc-dim">{row.resultToggle.size}</span>
            )}
            {` ${chevron(resultOpen)}`}
          </button>
        )}
      </div>
      {row.secondLine !== undefined && <div className="tc-second">{row.secondLine}</div>}
      {inputOpen && <pre>{describeToolInput(call)}</pre>}
      {resultOpen &&
        result !== undefined &&
        describeResultParts(result).map((part, position) =>
          part.kind === 'text' ? (
            <pre key={position}>{part.text}</pre>
          ) : (
            <img key={position} src={part.src} alt="" />
          ),
        )}
    </div>
  );
});

function ToolStatusMark({ status }: { readonly status: ToolStatus }) {
  switch (status) {
    case 'running':
      return <span className="tc-status tc-spinner" role="img" aria-label="Running" />;
    case 'done':
      return (
        <span className="tc-status" role="img" aria-label="Done">
          ✓
        </span>
      );
    case 'failed':
      return (
        <span className="tc-status tc-status-failed" role="img" aria-label="Failed">
          ▲
        </span>
      );
    case 'none':
      return <span className="tc-status" />;
  }
}
