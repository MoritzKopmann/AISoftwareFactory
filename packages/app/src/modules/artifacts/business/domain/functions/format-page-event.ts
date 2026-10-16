import type { PageEvent } from '../types/page-event.js';

export function formatPageEvent(artifactId: string, event: PageEvent): string {
  const json = JSON.stringify(event.payload);
  return `<aisf-event artifact=${artifactId} kind=${event.kind} round=${event.round}>${json}</aisf-event>`;
}
