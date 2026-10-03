import Markdown from 'markdown-to-jsx/react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

type TicketBodyMarkdownProps = {
  readonly source: string;
};

const webTargetPattern = /^https?:/i;

function SafeLink({ href, children }: { readonly href?: string; readonly children?: ReactNode }) {
  if (href === undefined || !webTargetPattern.test(href)) {
    return <>{children}</>;
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

function ScrollingTable(props: ComponentPropsWithoutRef<'table'>) {
  return (
    <div className="ticket-markdown-table">
      <table {...props} />
    </div>
  );
}

function DisabledInput(props: ComponentPropsWithoutRef<'input'>) {
  return <input {...props} disabled />;
}

const markdownOverrides = { a: SafeLink, table: ScrollingTable, input: DisabledInput };

export function TicketBodyMarkdown({ source }: TicketBodyMarkdownProps) {
  return (
    <div className="ticket-markdown">
      <Markdown options={{ overrides: markdownOverrides }}>{source}</Markdown>
    </div>
  );
}
