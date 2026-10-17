import type { SessionStreamFrame } from '@aisf/app/api-schemas/session-stream-schemas.js';
import type {
  LiveSignal,
  LiveStream,
  LiveUpdates,
  LiveVisibility,
  OpenLiveStream,
} from '../live/live-updates.js';
import { noticeConcernsView } from '../live/notice-concerns-view.js';
import {
  foldSessionView,
  initialSessionView,
  markConnectionLost,
  type SessionView,
} from './fold-session-view.js';

export type FrameScheduler = {
  request(callback: () => void): number;
  cancel(handle: number): void;
};

export type SessionStream = { close(): void };

const connectingReadyState = 0;

const frameKinds: ReadonlySet<string> = new Set([
  'snapshot',
  'no-session',
  'transcript-not-found',
  'entry',
  'delta',
  'ended',
]);

/**
 * Follows one ticket's session stream. Deltas wait for the next animation frame and apply
 * together; any other frame applies at once, after the waiting deltas. After `ended` the
 * stream stays closed until `run.started` for this ticket.
 */
export function createSessionStream(dependencies: {
  url: string;
  projectId: string;
  ticketNumber: number;
  openStream: OpenLiveStream;
  visibility: LiveVisibility;
  liveUpdates: LiveUpdates;
  frames: FrameScheduler;
  onChange: (view: SessionView) => void;
}): SessionStream {
  const { url, projectId, ticketNumber, openStream, visibility, liveUpdates, frames, onChange } =
    dependencies;
  let view: SessionView = initialSessionView;
  let stream: LiveStream | undefined;
  let ended = false;
  let waiting: SessionStreamFrame[] = [];
  let frameHandle: number | undefined;

  const apply = (batch: ReadonlyArray<SessionStreamFrame>) => {
    view = batch.reduce(foldSessionView, view);
    onChange(view);
  };

  const flush = () => {
    if (frameHandle !== undefined) frames.cancel(frameHandle);
    frameHandle = undefined;
    const batch = waiting;
    waiting = [];
    if (batch.length > 0) apply(batch);
  };

  const receive = (frame: SessionStreamFrame) => {
    if (frame.kind === 'delta') {
      waiting.push(frame);
      frameHandle ??= frames.request(flush);
      return;
    }
    flush();
    apply([frame]);
    if (frame.kind === 'ended') {
      ended = true;
      close();
    }
  };

  const open = () => {
    const opened = openStream(url);
    stream = opened;
    opened.onmessage = (event) => {
      const frame = parseFrame(event.data);
      if (frame) receive(frame);
    };
    opened.onerror = () => {
      if (opened !== stream) return;
      if (opened.readyState === connectingReadyState) {
        flush();
        const lost = markConnectionLost(view);
        if (lost !== view) {
          view = lost;
          onChange(view);
        }
        return;
      }
      close();
    };
  };

  const isIdle = () => !stream && !ended;

  function close() {
    stream?.close();
    stream = undefined;
  }

  const onVisibility = () => {
    if (visibility.visibilityState === 'hidden') {
      close();
      return;
    }
    if (isIdle()) open();
  };
  visibility.addEventListener('visibilitychange', onVisibility);

  const unlisten = liveUpdates.listen((signal) => {
    if (!startsRunOnThisTicket(signal, projectId, ticketNumber)) return;
    ended = false;
    close();
    if (visibility.visibilityState !== 'hidden') open();
  });

  if (visibility.visibilityState !== 'hidden') open();

  return {
    close() {
      close();
      unlisten();
      visibility.removeEventListener('visibilitychange', onVisibility);
      if (frameHandle !== undefined) frames.cancel(frameHandle);
      frameHandle = undefined;
      waiting = [];
    },
  };
}

function startsRunOnThisTicket(
  signal: LiveSignal,
  projectId: string,
  ticketNumber: number,
): boolean {
  return (
    signal.kind === 'notice' &&
    signal.notice.event === 'run.started' &&
    noticeConcernsView(signal.notice, { kind: 'run', projectId, ticketNumber })
  );
}

function isSessionStreamFrame(parsed: unknown): parsed is SessionStreamFrame {
  return (
    typeof parsed === 'object' &&
    parsed !== null &&
    'kind' in parsed &&
    typeof parsed.kind === 'string' &&
    frameKinds.has(parsed.kind)
  );
}

function parseFrame(data: string): SessionStreamFrame | undefined {
  try {
    const parsed: unknown = JSON.parse(data);
    return isSessionStreamFrame(parsed) ? parsed : undefined;
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return undefined;
  }
}
