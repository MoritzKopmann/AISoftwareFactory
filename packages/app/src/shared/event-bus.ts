import type { TicketStatus } from './ticket-status/ticket-status.js';

export type DomainEvents = {
  readonly 'project.added': {
    readonly projectId: string;
    readonly repository: { readonly owner: string; readonly name: string };
    readonly checkoutPath: string;
  };
  readonly 'snapshot.changed': {
    readonly projectId: string;
    readonly addedTicketNumbers: ReadonlyArray<number>;
    readonly changedTicketNumbers: ReadonlyArray<number>;
    readonly removedTicketNumbers: ReadonlyArray<number>;
  };
  readonly 'run.finished': {
    readonly runId: string;
    readonly projectId: string;
    readonly ticketNumber: number;
    readonly stage: 'implement' | 'spike' | 'create' | 'plan';
    readonly ending:
      | {
          readonly kind: 'escalated';
          readonly escalation: 'red' | 'spec' | 'denied';
          readonly reason: string;
        }
      | {
          readonly kind: 'permission-needed';
          readonly toolName: string;
          readonly toolInput: Readonly<Record<string, unknown>>;
          readonly reason?: string;
        }
      | { readonly kind: 'parked'; readonly blockerNumber: number }
      | { readonly kind: 'finished' }
      | { readonly kind: 'stopped' }
      | { readonly kind: 'crashed'; readonly reason: string }
      | { readonly kind: 'usage-limit'; readonly reason: string }
      | { readonly kind: 'app-restarted' }
      | { readonly kind: 'checkpoint'; readonly request: string; readonly artifactId?: string };
  };
  readonly 'run.waiting': {
    readonly runId: string;
    readonly projectId: string;
    readonly ticketNumber: number;
    readonly stage: 'implement' | 'spike' | 'create' | 'plan';
    readonly wait:
      | { readonly kind: 'checkpoint'; readonly request: string; readonly artifactId?: string }
      | {
          readonly kind: 'permission-needed';
          readonly toolName: string;
          readonly toolInput: Readonly<Record<string, unknown>>;
          readonly reason?: string;
        };
  };
  readonly 'ticket.status-written': {
    readonly projectId: string;
    readonly ticketNumber: number;
    readonly from: TicketStatus;
    readonly to: TicketStatus;
    readonly waiting: boolean;
    readonly stuck: boolean;
  };
  readonly 'run.started': {
    readonly runId: string;
    readonly projectId: string;
    readonly ticketNumber: number;
  };
  readonly 'run.wait-cleared': {
    readonly runId: string;
    readonly projectId: string;
    readonly ticketNumber: number;
  };
  readonly 'finding.changed': {
    readonly projectId: string;
    readonly ticketNumber: number;
    readonly findingId: number;
  };
  readonly 'artifact.published': {
    readonly projectId: string;
    readonly ticketNumber: number;
    readonly artifactId: string;
  };
  readonly 'watch.updated': {
    readonly projectId: string;
    readonly changed: boolean;
    readonly polledAt: string;
  };
  readonly 'skills.status-changed': Readonly<Record<never, never>>;
};

type EventName = keyof DomainEvents;

// Resolves to the names the list forgot; a non-empty union makes the list fail to compile.
type ListedNames<List extends ReadonlyArray<EventName>> = List[number];
type RequireEveryName<List extends ReadonlyArray<EventName>> = [
  Exclude<EventName, ListedNames<List>>,
] extends [never]
  ? List
  : never;

function listEveryName<const List extends ReadonlyArray<EventName>>(
  names: RequireEveryName<List>,
): List {
  return names as unknown as List;
}

/** Every DomainEvents key at runtime. The type checker rejects a missing or an extra name. */
export const domainEventNames = listEveryName([
  'project.added',
  'snapshot.changed',
  'run.started',
  'run.waiting',
  'run.wait-cleared',
  'run.finished',
  'ticket.status-written',
  'finding.changed',
  'artifact.published',
  'watch.updated',
  'skills.status-changed',
]);

export interface EventPublisher {
  emit<Name extends keyof DomainEvents>(name: Name, payload: DomainEvents[Name]): void;
}

export interface EventSubscriber {
  on<Name extends keyof DomainEvents>(
    name: Name,
    handler: (payload: DomainEvents[Name]) => void,
  ): () => void;
}

export type EventBus = EventPublisher & EventSubscriber;
