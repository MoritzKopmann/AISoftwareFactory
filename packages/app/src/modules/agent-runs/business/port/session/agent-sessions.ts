import type { SessionEvent } from '../../domain/types/session-event.js';
import type { ResumeSessionSpec } from '../../domain/types/resume-session-spec.js';
import type { SessionSpec } from '../../domain/types/session-spec.js';

export interface AgentSessions {
  start(spec: SessionSpec): AsyncIterable<SessionEvent>;
  resume(spec: ResumeSessionSpec): AsyncIterable<SessionEvent>;
  /** `closed` when the session has no open input: unknown, ended, or closing. */
  send(sessionId: string, messageId: string, text: string): 'pushed' | 'closed';
  stop(sessionId: string): void;
  stopAll(): void;
}
