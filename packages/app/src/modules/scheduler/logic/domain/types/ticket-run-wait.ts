import type { RunPage } from './run-page.js';
import type { RunWait } from './run-wait.js';

export type TicketRunWait =
  RunWait | (Extract<RunWait, { kind: 'checkpoint' }> & { readonly page: RunPage });
