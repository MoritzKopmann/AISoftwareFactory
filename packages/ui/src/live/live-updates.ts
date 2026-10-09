import type { LiveNotice } from '@aisf/app/api-schemas/live-notice-schemas.js';

export type LiveConnection = 'connecting' | 'open' | 'offline' | 'paused';

export type LiveSignal =
  | { kind: 'notice'; notice: LiveNotice }
  | { kind: 'opened' }
  | { kind: 'connection'; connection: LiveConnection };

export type LiveUpdates = {
  listen(listener: (signal: LiveSignal) => void): () => void;
  connection(): LiveConnection;
};

/** The EventSource subset the client uses. */
export type LiveStream = {
  onopen: ((event: Event) => void) | null;
  onerror: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent<string>) => void) | null;
  readonly readyState: number;
  close(): void;
};

export type OpenLiveStream = (url: string) => LiveStream;

/** The document subset the client uses. */
export type LiveVisibility = {
  readonly visibilityState: string;
  addEventListener(type: 'visibilitychange', listener: () => void): void;
  removeEventListener(type: 'visibilitychange', listener: () => void): void;
};
