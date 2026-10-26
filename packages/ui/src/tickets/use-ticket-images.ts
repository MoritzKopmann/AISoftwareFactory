import { useState } from 'react';
import type { LiveUpdates } from '../live/live-updates.js';
import { useLiveRead } from '../live/use-live-read.js';
import type { TicketPageOutcome } from './describe-ticket-page.js';
import { fetchTicketImages, type TicketImage } from './fetch-ticket-images.js';
import { ticketLiveView } from './ticket-live-view.js';

/** Re-reads on the same live events as the ticket view. */
export function useTicketImages(
  liveUpdates: LiveUpdates,
  projectId: string,
  number: number,
  outcome: TicketPageOutcome,
): readonly TicketImage[] {
  const [images, setImages] = useState<readonly TicketImage[]>([]);

  useLiveRead(
    liveUpdates,
    ticketLiveView(projectId, number, outcome),
    () => fetchTicketImages(projectId, number, (url) => fetch(url)),
    setImages,
  );

  return images;
}
