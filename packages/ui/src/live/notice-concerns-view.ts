import type { LiveNotice } from '@aisf/app/api-schemas/live-notice-schemas.js';

export type LiveView =
  | { kind: 'board'; projectId: string }
  | { kind: 'ticket'; projectId: string; ticketNumber: number; closed: boolean }
  | { kind: 'run'; projectId: string; ticketNumber: number }
  | { kind: 'artifacts'; projectId: string; ticketNumber: number }
  | { kind: 'findings'; projectId: string; ticketNumber?: number }
  | { kind: 'skills' };

export function noticeConcernsView(notice: LiveNotice, view: LiveView): boolean {
  if (notice.event === 'skills.status-changed')
    return view.kind === 'skills' || view.kind === 'run';
  if (view.kind === 'skills' || notice.projectId !== view.projectId) return false;

  switch (notice.event) {
    case 'watch.updated':
      return (
        view.kind === 'board' || view.kind === 'run' || (view.kind === 'ticket' && !view.closed)
      );
    case 'ticket.status-written':
    case 'run.started':
    case 'run.finished':
      return view.kind === 'board' || (isTicketScoped(view) && sameTicket(notice, view));
    case 'run.waiting':
    case 'run.wait-cleared':
      return isTicketScoped(view) && sameTicket(notice, view);
    case 'run.step-added':
      return view.kind === 'run' && sameTicket(notice, view);
    case 'artifact.published':
      return view.kind === 'artifacts' && sameTicket(notice, view);
    case 'finding.changed':
      return (
        view.kind === 'findings' && (view.ticketNumber === undefined || sameTicket(notice, view))
      );
    case 'snapshot.changed':
    case 'project.added':
      return false;
  }
}

function isTicketScoped(view: LiveView): boolean {
  return view.kind === 'ticket' || view.kind === 'run' || view.kind === 'artifacts';
}

function sameTicket(notice: LiveNotice, view: LiveView & { ticketNumber?: number }): boolean {
  return notice.ticketNumber === view.ticketNumber;
}
