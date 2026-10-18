import { describeTicketBody } from './describe-ticket-body.js';
import { TicketBodyMarkdown } from './ticket-body-markdown.js';

type TicketBodySectionProps = {
  readonly body: string;
};

export function TicketBodySection({ body }: TicketBodySectionProps) {
  const description = describeTicketBody(body);
  return (
    <section className="ticket-body" id="ticket-description" aria-label="Description">
      <div className="head">
        <h2 className="lead">Description</h2>
      </div>
      <div className="body">
        {description.kind === 'empty' ? (
          <p className="ticket-body-empty">No description</p>
        ) : (
          <TicketBodyMarkdown source={description.source} />
        )}
      </div>
    </section>
  );
}
