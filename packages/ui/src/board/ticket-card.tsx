import type { RunMarker, TicketCardDescription } from './describe-ticket-card.js';
import { StatusShape } from './status-shape.js';

function RunMarkerChip({ marker }: { marker: RunMarker }) {
  if (marker === 'stuck') {
    return (
      <span className="chip danger">
        <StatusShape status="stuck" />
        Stuck
      </span>
    );
  }
  return (
    <span className="chip flow">
      <StatusShape status="in-progress" />
      Running
    </span>
  );
}

export function TicketCard({
  href,
  numberLabel,
  title,
  parentTitle,
  hitl,
  blockerLabels,
  conflictLabels,
  pullRequestChips,
  runMarker,
}: TicketCardDescription) {
  const hasMeta =
    runMarker !== undefined ||
    conflictLabels.length > 0 ||
    hitl ||
    blockerLabels.length > 0 ||
    pullRequestChips.length > 0;
  return (
    <a className="card" href={href} title={title}>
      <span className="title">
        <span className="num-id">{numberLabel}</span>
        {title}
      </span>
      {parentTitle !== undefined && <span className="parent">↳ {parentTitle}</span>}
      {hasMeta && (
        <span className="meta">
          {runMarker !== undefined && <RunMarkerChip marker={runMarker} />}
          {conflictLabels.length > 0 && <span>{conflictLabels.join(' · ')}</span>}
          {hitl && <span className="chip hitl">HITL</span>}
          {blockerLabels.map((label) => (
            <span key={label}>{label}</span>
          ))}
          {pullRequestChips.map((chip) => (
            <span key={chip.label} className="chip">
              {chip.label}
            </span>
          ))}
        </span>
      )}
    </a>
  );
}
