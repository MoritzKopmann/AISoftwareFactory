import type { RepositoryWatchServiceDependencies } from '../business/service/repository-watch-service.js';
import type { TicketReadServiceDependencies } from '../business/service/ticket-read-service.js';
import type { TicketStatusServiceDependencies } from '../business/service/ticket-status-service.js';

function unused<Port extends object>(name: string): Port {
  return new Proxy(
    {},
    {
      get: () => {
        throw new Error(`${name} is not expected to be used in this test`);
      },
    },
  ) as Port;
}

export const unusedTicketStatusDependencies: TicketStatusServiceDependencies = {
  ticketStatusWrites: unused('ticketStatusWrites'),
  runPort: unused('runPort'),
  projectPort: unused('projectPort'),
  events: unused('events'),
  logger: unused('logger'),
};

export const unusedTicketReadDependencies: TicketReadServiceDependencies = {
  ticketSource: unused('ticketSource'),
  runPort: unused('runPort'),
  clock: unused('clock'),
  watchStore: unused('watchStore'),
};

export const unusedRepositoryWatchDependencies: RepositoryWatchServiceDependencies = {
  issueFeeds: unused('issueFeeds'),
  ticketSource: unused('ticketSource'),
  projectPort: unused('projectPort'),
  clock: unused('clock'),
  events: unused('events'),
  watchStore: unused('watchStore'),
  pollIntervalMilliseconds: 0,
  snapshotIntervalMilliseconds: 0,
};
