import type { TicketCardDescription } from './describe-ticket-card.js';

export function TicketCard({
  href,
  numberLabel,
  title,
  parentTitle,
  hitl,
  blockerLabels,
  conflictLabels,
  pullRequestChips,
}: TicketCardDescription) {
  const hasMeta =
    conflictLabels.length > 0 || hitl || blockerLabels.length > 0 || pullRequestChips.length > 0;
  return (
    <a className="card" href={href} title={title}>
      <span className="title">
        <span className="num-id">{numberLabel}</span>
        {title}
      </span>
      {parentTitle !== undefined && <span className="parent">↳ {parentTitle}</span>}
      {hasMeta && (
        <span className="meta">
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
