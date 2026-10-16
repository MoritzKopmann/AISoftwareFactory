import type { PageStatus } from './page-status.js';

export type PageState = {
  readonly status: PageStatus;
  readonly version: number;
};
