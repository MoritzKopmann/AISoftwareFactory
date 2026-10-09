import { describe, expect, it } from 'vitest';
import type { LiveNotice } from '@aisf/app/api-schemas/live-notice-schemas.js';
import { noticeConcernsView, type LiveView } from '../../src/live/notice-concerns-view.js';

const p = 'octo/repo';
const board = (projectId = p): LiveView => ({ kind: 'board', projectId });
const ticket = (closed: boolean, n = 7): LiveView => ({
  kind: 'ticket',
  projectId: p,
  ticketNumber: n,
  closed,
});
const run = (n = 7): LiveView => ({ kind: 'run', projectId: p, ticketNumber: n });
const artifacts = (n = 7): LiveView => ({ kind: 'artifacts', projectId: p, ticketNumber: n });
const findings = (n?: number): LiveView =>
  n === undefined
    ? { kind: 'findings', projectId: p }
    : { kind: 'findings', projectId: p, ticketNumber: n };
const skills: LiveView = { kind: 'skills' };

const on = (event: LiveNotice['event'], ticketNumber?: number): LiveNotice =>
  ticketNumber === undefined ? { event, projectId: p } : { event, projectId: p, ticketNumber };

const noChange = (): LiveNotice => ({
  event: 'watch.updated',
  projectId: p,
  changed: false,
  polledAt: '2026-09-28T10:00:00.000Z',
});
const changed = (): LiveNotice => ({ ...noChange(), changed: true });

describe('noticeConcernsView', () => {
  it.each<[string, LiveNotice, LiveView, boolean]>([
    ['watch.updated', on('watch.updated'), board(), true],
    ['watch.updated', on('watch.updated'), board('octo/other'), false],
    ['watch.updated', on('watch.updated'), ticket(false), true],
    ['watch.updated', on('watch.updated'), ticket(true), false],
    ['watch.updated', on('watch.updated'), run(), true],
    ['ticket.status-written', on('ticket.status-written', 7), board(), true],
    ['ticket.status-written', on('ticket.status-written', 7), ticket(true), true],
    ['ticket.status-written', on('ticket.status-written', 7), run(8), false],
    ['run.started', on('run.started', 7), board(), true],
    ['run.finished', on('run.finished', 7), artifacts(), true],
    ['run.waiting', on('run.waiting', 7), board(), false],
    ['run.wait-cleared', on('run.wait-cleared', 7), artifacts(), true],
    ['run.step-added', on('run.step-added', 7), run(), true],
    ['run.step-added', on('run.step-added', 7), run(8), false],
    ['run.step-added', on('run.step-added', 7), artifacts(), false],
    ['artifact.published', on('artifact.published', 7), artifacts(), true],
    ['finding.changed', on('finding.changed', 7), findings(), true],
    ['finding.changed', on('finding.changed', 7), findings(8), false],
    ['finding.changed', on('finding.changed', 7), findings(7), true],
    ['skills.status-changed', { event: 'skills.status-changed' }, skills, true],
    ['skills.status-changed', { event: 'skills.status-changed' }, run(), true],
    ['snapshot.changed', on('snapshot.changed'), board(), false],
    ['project.added', on('project.added'), board(), false],
    ['watch.updated no-change', noChange(), board(), false],
    ['watch.updated no-change', noChange(), ticket(false), false],
    ['watch.updated no-change', noChange(), run(), false],
    ['watch.updated changed', changed(), board(), true],
    ['watch.updated changed', changed(), ticket(false), true],
    ['watch.updated changed', changed(), run(), true],
    ['watch.updated changed', changed(), ticket(true), false],
    ['watch.updated changed', changed(), findings(), false],
    ['watch.updated changed', changed(), artifacts(), false],
    ['watch.updated changed', changed(), skills, false],
  ])('should map %s to the view as expected', (_name, notice, view, expected) => {
    expect(noticeConcernsView(notice, view)).toBe(expected);
  });
});
