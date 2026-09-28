import type { SessionEvent } from '../domain/types/session-event.js';
import type { SessionSpec } from '../domain/types/session-spec.js';

export interface AgentSessions {
  start(spec: SessionSpec): AsyncIterable<SessionEvent>;
  stop(sessionId: string): void;
  stopAll(): void;
}
