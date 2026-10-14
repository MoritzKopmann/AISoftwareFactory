const maximumSlugLength = 50;

export function branchNameFor(ticketNumber: number, ticketTitle: string): string {
  const slug = ticketTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, maximumSlugLength)
    .replace(/-+$/, '');

  return slug === '' ? `aisf/${ticketNumber}` : `aisf/${ticketNumber}-${slug}`;
}
