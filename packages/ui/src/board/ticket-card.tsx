import { CardMoveToPlanAction } from './card-move-to-plan-action.js';
import type { TicketCardDescription } from './describe-ticket-card.js';
import { RunMarkerChip } from './run-marker-chip.js';

export function TicketCard({
  projectId,
  href,
  number,
  numberLabel,
  title,
  backlog,
  parentTitle,
  hitl,
  spike,
  blockerLabels,
  conflictLabels,
  pullRequestChips,
  runMarker,
}: TicketCardDescription & { readonly projectId: string }) {
  const hasMeta =
    runMarker !== undefined ||
    conflictLabels.length > 0 ||
    hitl ||
    spike ||
    blockerLabels.length > 0 ||
    pullRequestChips.length > 0;
  const parentLine = parentTitle !== undefined && <span className="parent">↳ {parentTitle}</span>;
  const metaRow = hasMeta && (
    <span className="meta">
      {runMarker !== undefined && <RunMarkerChip marker={runMarker} />}
      {conflictLabels.length > 0 && <span>{conflictLabels.join(' · ')}</span>}
      {hitl && <span className="chip hitl">HITL</span>}
      {spike && <span className="chip spike">SPIKE</span>}
      {blockerLabels.map((label) => (
        <span key={label}>{label}</span>
      ))}
      {pullRequestChips.map((chip) => (
        <span key={chip.label} className="chip">
          {chip.label}
        </span>
      ))}
    </span>
  );
  const titleContent = (
    <>
      <span className="num-id">{numberLabel}</span>
      {title}
    </>
  );
  if (backlog) {
    // A button inside an <a> is invalid HTML, so only the title is the link here.
    return (
      <div className="card card-backlog">
        <a className="title" href={href} title={title}>
          {titleContent}
        </a>
        {parentLine}
        {metaRow}
        <CardMoveToPlanAction projectId={projectId} number={number} />
      </div>
    );
  }
  return (
    <a className="card" href={href} title={title}>
      <span className="title">{titleContent}</span>
      {parentLine}
      {metaRow}
    </a>
  );
}
