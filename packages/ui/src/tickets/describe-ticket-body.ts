export type TicketBodyDescription =
  { readonly kind: 'empty' } | { readonly kind: 'markdown'; readonly source: string };

export function describeTicketBody(body: string): TicketBodyDescription {
  return body.trim() === '' ? { kind: 'empty' } : { kind: 'markdown', source: body };
}
