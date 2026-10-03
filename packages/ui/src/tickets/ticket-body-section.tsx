import { describeTicketBody } from './describe-ticket-body.js';
import { TicketBodyMarkdown } from './ticket-body-markdown.js';

type TicketBodySectionProps = {
  readonly body: string;
};

export function TicketBodySection({ body }: TicketBodySectionProps) {
  const description = describeTicketBody(body);
  return (
    <details className="row ticket-body">
      <summary className="row-h">
        <span className="chev" aria-hidden="true">
          ›
        </span>
        <span className="label">Description</span>
        <span className="toggle-text">
          <span className="t-show">Show description</span>
          <span className="t-hide">Hide description</span>
        </span>
      </summary>
      <div className="ticket-body-box">
        {description.kind === 'empty' ? (
          <p className="ticket-body-empty">No description</p>
        ) : (
          <TicketBodyMarkdown source={description.source} />
        )}
      </div>
    </details>
  );
}
