import { describe, expect, it } from 'vitest';
import type { LiveNotice } from '@aisf/app/api-schemas/live-notice-schemas.js';
import { noticeConcernsView, type LiveView } from './notice-concerns-view.js';

const defaultProjectId = 'octo/repo';
const board = (projectId = defaultProjectId): LiveView => ({ kind: 'board', projectId });
const ticket = (closed: boolean, ticketNumber = 7): LiveView => ({
  kind: 'ticket',
  projectId: defaultProjectId,
  ticketNumber,
  closed,
});
const run = (ticketNumber = 7): LiveView => ({
  kind: 'run',
  projectId: defaultProjectId,
  ticketNumber,
});
const findings = (ticketNumber?: number): LiveView =>
  ticketNumber === undefined
    ? { kind: 'findings', projectId: defaultProjectId }
    : { kind: 'findings', projectId: defaultProjectId, ticketNumber };
const skills: LiveView = { kind: 'skills' };
const needsYou = (projectId = defaultProjectId): LiveView => ({ kind: 'needs-you', projectId });

const on = (event: LiveNotice['event'], ticketNumber?: number): LiveNotice =>
  ticketNumber === undefined
    ? { event, projectId: defaultProjectId }
    : { event, projectId: defaultProjectId, ticketNumber };

const noChange = (): LiveNotice => ({
  event: 'watch.updated',
  projectId: defaultProjectId,
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
    ['run.finished', on('run.finished', 7), run(), true],
    ['run.waiting', on('run.waiting', 7), board(), false],
    ['run.wait-cleared', on('run.wait-cleared', 7), run(), true],
    ['artifact.published', on('artifact.published', 7), run(), false],
    ['artifact.published', on('artifact.published', 7), ticket(false), false],
    ['finding.changed', on('finding.changed', 7), findings(), true],
    ['finding.changed', on('finding.changed', 7), findings(8), false],
    ['finding.changed', on('finding.changed', 7), findings(7), true],
    ['skills.status-changed', { event: 'skills.status-changed' }, skills, true],
    ['skills.status-changed', { event: 'skills.status-changed' }, run(), true],
    ['snapshot.changed', on('snapshot.changed'), board(), false],
    ['project.added', on('project.added'), board(), false],
    ['ticket.closed', on('ticket.closed', 7), board(), false],
    ['ticket.closed', on('ticket.closed', 7), ticket(true), false],
    ['watch.updated no-change', noChange(), board(), false],
    ['watch.updated no-change', noChange(), ticket(false), false],
    ['watch.updated no-change', noChange(), run(), false],
    ['watch.updated changed', changed(), board(), true],
    ['watch.updated changed', changed(), ticket(false), true],
    ['watch.updated changed', changed(), run(), true],
    ['watch.updated changed', changed(), ticket(true), false],
    ['watch.updated changed', changed(), findings(), false],
    ['watch.updated changed', changed(), skills, false],
  ])('should map %s to the view as expected', (_name, notice, view, expected) => {
    expect(noticeConcernsView(notice, view)).toBe(expected);
  });
});

describe('noticeConcernsView for usage', () => {
  const usage: LiveView = { kind: 'usage' };
  const usageChanged: LiveNotice = { event: 'usage.changed' };

  it('should concern the meter when usage.changed arrives', () => {
    expect(noticeConcernsView(usageChanged, usage)).toBe(true);
  });

  it.each<LiveNotice['event']>([
    'watch.updated',
    'run.started',
    'usage.window-observed',
    'skills.status-changed',
  ])('should not concern the meter when %s arrives', (event) => {
    expect(noticeConcernsView({ event, projectId: defaultProjectId }, usage)).toBe(false);
  });
});

describe('noticeConcernsView for needs-you', () => {
  it.each<LiveNotice['event']>([
    'ticket.status-written',
    'run.waiting',
    'run.wait-cleared',
    'run.finished',
  ])('should concern the list when %s arrives for the project', (event) => {
    expect(noticeConcernsView(on(event, 7), needsYou())).toBe(true);
  });

  it('should concern the list when watch.updated changed something', () => {
    expect(noticeConcernsView(changed(), needsYou())).toBe(true);
  });

  it('should not concern the list when watch.updated changed nothing', () => {
    expect(noticeConcernsView(noChange(), needsYou())).toBe(false);
  });

  it('should not concern the list when the notice is of another project', () => {
    expect(noticeConcernsView(on('run.waiting', 7), needsYou('octo/other'))).toBe(false);
  });
});

describe('noticeConcernsView for projects', () => {
  const projects: LiveView = { kind: 'projects' };

  it.each(['p1', 'p2'])(
    'should concern the project list when project.checkout-refreshed arrives for %s',
    (projectId) => {
      expect(noticeConcernsView({ event: 'project.checkout-refreshed', projectId }, projects)).toBe(
        true,
      );
    },
  );

  it.each(['ticket.closed', 'watch.updated', 'project.added'] as const)(
    'should not concern the project list when %s arrives',
    (event) => {
      expect(noticeConcernsView({ event, projectId: 'p1' }, projects)).toBe(false);
    },
  );

  it.each([board('p1'), { kind: 'usage' } as LiveView, skills])(
    'should not concern the $kind view when project.checkout-refreshed arrives',
    (view) => {
      expect(
        noticeConcernsView({ event: 'project.checkout-refreshed', projectId: 'p1' }, view),
      ).toBe(false);
    },
  );
});
