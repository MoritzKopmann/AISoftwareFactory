import { liveNoticeSchema } from '@aisf/app/api-schemas/live-notice-schemas.js';
import type {
  LiveConnection,
  LiveSignal,
  LiveStream,
  LiveUpdates,
  LiveVisibility,
  OpenLiveStream,
} from './live-updates.js';

const eventsUrl = '/api/events';
const closedReadyState = 2;

export function createLiveUpdates(dependencies: {
  openStream: OpenLiveStream;
  visibility: LiveVisibility;
}): LiveUpdates {
  const { openStream, visibility } = dependencies;
  const listeners = new Set<(signal: LiveSignal) => void>();
  let connection: LiveConnection = 'connecting';
  let stream: LiveStream | undefined;

  const emit = (signal: LiveSignal) => listeners.forEach((listener) => listener(signal));

  const setConnection = (next: LiveConnection) => {
    if (next === connection) return;
    connection = next;
    emit({ kind: 'connection', connection });
  };

  const open = () => {
    const opened = openStream(eventsUrl);
    stream = opened;
    opened.onopen = () => {
      setConnection('open');
      emit({ kind: 'opened' });
    };
    opened.onerror = () => setConnection('offline');
    opened.onmessage = (event) => {
      const notice = parseNotice(event.data);
      if (notice) emit({ kind: 'notice', notice });
    };
  };

  const close = () => {
    stream?.close();
    stream = undefined;
  };

  visibility.addEventListener('visibilitychange', () => {
    if (visibility.visibilityState === 'hidden') {
      close();
      setConnection('paused');
      return;
    }
    if (stream && stream.readyState !== closedReadyState) return;
    close();
    setConnection('connecting');
    open();
  });

  if (visibility.visibilityState === 'hidden') connection = 'paused';
  else open();

  return {
    listen(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    connection: () => connection,
  };
}

function parseNotice(data: string) {
  try {
    const parsed = liveNoticeSchema.safeParse(JSON.parse(data));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}
