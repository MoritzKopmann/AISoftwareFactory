import type { TicketStatusResponse } from '@aisf/app/api-schemas/tickets-schemas.js';
import type { ReactNode } from 'react';
import type { BoardRowDescription } from './describe-board.js';
import { describeTicketCard } from './describe-ticket-card.js';
import { StatusShape } from './status-shape.js';
import { TicketCard } from './ticket-card.js';
import { ticketStatusLabel } from './ticket-status-labels.js';

export const boardStatuses: ReadonlyArray<TicketStatusResponse> = [
  'idea',
  'backlog',
  'plan',
  'planned',
  'ready',
  'in-progress',
  'waiting',
  'in-review',
  'stuck',
  'conflict',
  'closed',
];

const skeletonLineWidths: ReadonlyArray<ReadonlyArray<readonly [string, string]>> = [
  [
    ['80%', '50%'],
    ['70%', '40%'],
  ],
  [
    ['75%', '45%'],
    ['60%', '35%'],
  ],
];

function ClosedSummary({
  status,
  label,
  children,
}: {
  status: TicketStatusResponse;
  label: string;
  children: ReactNode;
}) {
  return (
    <summary className="row-h">
      <span className="chev" aria-hidden="true">
        ›
      </span>
      <StatusShape status={status} />
      <span className="label">{label}</span>
      {children}
    </summary>
  );
}

function ClosedNote({ projectId, truncated }: { projectId: string; truncated: boolean }) {
  return (
    <p className="row-note sm">
      {truncated && 'The newest 50. '}
      <a
        className="ext"
        href={`https://github.com/${projectId}/issues?q=is%3Aissue+is%3Aclosed`}
        target="_blank"
        rel="noopener"
      >
        All closed on GitHub
      </a>
    </p>
  );
}

function BoardRow({
  row,
  projectId,
  runningTicketNumber,
}: {
  row: BoardRowDescription;
  projectId: string;
  runningTicketNumber: number | undefined;
}) {
  const isEmpty = row.tickets.length === 0;
  const cards = (
    <div className="cards">
      {row.tickets.map((ticket) => (
        <TicketCard
          key={ticket.number}
          {...describeTicketCard(ticket, projectId, runningTicketNumber)}
        />
      ))}
    </div>
  );
  if (row.collapsedByDefault && !isEmpty) {
    return (
      <details className="row">
        <ClosedSummary status={row.key} label={row.label}>
          <span className="n">{row.countLabel}</span>
          <span className="toggle-text">
            <span className="t-show">Show closed</span>
            <span className="t-hide">Hide closed</span>
          </span>
        </ClosedSummary>
        {cards}
        <ClosedNote projectId={projectId} truncated={row.truncated} />
      </details>
    );
  }
  return (
    <section className="row">
      <div className="row-h">
        <StatusShape status={row.key} />
        <span className="label">{row.label}</span>
        <span className="n">{row.countLabel}</span>
        {isEmpty && <span className="none">None</span>}
      </div>
      {row.key === 'conflict' && !isEmpty && (
        <p className="row-note">
          These tickets carry more than one <code>status:</code> label. Keep one on GitHub.
        </p>
      )}
      {!isEmpty && cards}
    </section>
  );
}

export function Board({
  rows,
  projectId,
  runningTicketNumber,
}: {
  rows: ReadonlyArray<BoardRowDescription>;
  projectId: string;
  runningTicketNumber: number | undefined;
}) {
  return (
    <div className="board">
      {rows.map((row) => (
        <BoardRow
          key={row.key}
          row={row}
          projectId={projectId}
          runningTicketNumber={runningTicketNumber}
        />
      ))}
    </div>
  );
}

export function BoardSkeleton() {
  return (
    <div className="board" aria-busy="true">
      <span className="vh" role="status">
        Loading tickets…
      </span>
      {boardStatuses.map((status, rowIndex) => {
        const countBlock = <span className="sk" style={{ width: 14, height: 10 }} />;
        if (status === 'closed') {
          return (
            <details key={status} className="row">
              <ClosedSummary status={status} label={ticketStatusLabel(status)}>
                {countBlock}
              </ClosedSummary>
            </details>
          );
        }
        return (
          <section key={status} className="row">
            <div className="row-h">
              <StatusShape status={status} />
              <span className="label">{ticketStatusLabel(status)}</span>
              {countBlock}
            </div>
            <div className="cards">
              {(skeletonLineWidths[rowIndex % 2] ?? []).map(([firstWidth, secondWidth]) => (
                <span key={firstWidth} className="sk-card">
                  <span className="sk sk-line" style={{ width: firstWidth }} />
                  <span className="sk sk-line" style={{ width: secondWidth }} />
                </span>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
