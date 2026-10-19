import { describe, expect, it } from 'vitest';
import type { ProjectBoard } from '../../../business/domain/types/project-board.js';
import type { Ticket } from '../../../business/domain/types/ticket.js';
import { toProjectBoardResponse, toProjectTicketDto, toTicketDto } from './ticket-mapper.js';

const ticket: Ticket = {
  number: 7,
  title: 'Seven',
  url: 'https://github.com/owner/name/issues/7',
  body: 'Body',
  status: 'ready',
  conflictingStatuses: [],
  hitl: false,
  waiting: false,
  stuck: false,
  types: ['task'],
  parent: { number: 1, title: 'Parent' },
  subIssueNumbers: [],
  blockedBy: [{ repository: 'owner/name', number: 3, open: true }],
  closingPullRequests: [],
  updatedAt: '2026-09-01T00:00:00Z',
};

describe('ticket-mapper', () => {
  describe('toProjectBoardResponse', () => {
    it('should carry the rows, the sync status and the running tickets when the board is built', () => {
      const projectBoard: ProjectBoard = {
        projectId: 'owner/name',
        sync: { state: 'pending' },
        board: { rows: [{ key: 'ready', tickets: [ticket], totalCount: 1 }] },
        runningTicketNumbers: [7],
      };

      expect(toProjectBoardResponse(projectBoard)).toEqual(projectBoard);
    });

    it('should leave the board out when the project has none yet', () => {
      const response = toProjectBoardResponse({
        projectId: 'owner/name',
        sync: { state: 'pending' },
        runningTicketNumbers: [],
      });

      expect(response).not.toHaveProperty('board');
    });
  });

  describe('toTicketDto', () => {
    it('should copy every field when the ticket has a parent and a blocker', () => {
      expect(toTicketDto(ticket)).toEqual(ticket);
    });

    it('should carry the latest review activity when the closing pull request has it', () => {
      const withPullRequest: Ticket = {
        ...ticket,
        closingPullRequests: [
          {
            number: 5,
            url: 'https://github.com/owner/name/pull/5',
            state: 'OPEN',
            approved: false,
            checks: 'passing',
            mergeable: 'mergeable',
            canBeRebased: true,
            headCommit: 'a',
            lastReviewActivityAt: '2026-10-18T10:00:00Z',
          },
        ],
      };

      expect(toTicketDto(withPullRequest).closingPullRequests[0]?.lastReviewActivityAt).toBe(
        '2026-10-18T10:00:00Z',
      );
    });

    it('should leave the parent out when the ticket has none', () => {
      const withoutParent: Ticket = { ...ticket, types: [] };
      delete (withoutParent as { parent?: unknown }).parent;

      expect(toTicketDto(withoutParent)).not.toHaveProperty('parent');
    });
  });

  describe('toProjectTicketDto', () => {
    it('should leave the ticket out when the project has no such ticket', () => {
      const dto = toProjectTicketDto({ projectId: 'owner/name', sync: { state: 'pending' } });

      expect(dto).toEqual({ projectId: 'owner/name', sync: { state: 'pending' } });
    });
  });
});
