import { describe, expect, it } from 'vitest';
import { sessionStreamFrameSchema } from '../dto/api/session-stream-schemas.js';
import type { SessionEntry } from '../../business/domain/types/session-entry.js';
import { RunQueryService } from '../../business/service/run-query-service.js';
import {
  buildRun,
  FakeRecentRunSteps,
  FakeRunRepository,
  FakeRunTranscripts,
  FakeSessionFeed,
} from '../../testing/fake-agent-runs-ports.js';
import { createSessionStreamRoutes } from './create-session-stream-routes.js';

const prompt: SessionEntry = { kind: 'prompt', id: 'm1#0', text: 'Go' };
const text: SessionEntry = { kind: 'text', id: 'm2#0', text: 'Hi' };
const call: SessionEntry = {
  kind: 'tool-call',
  id: 'm2#1',
  toolUseId: 't',
  name: 'Read',
  input: {},
};
const result: SessionEntry = {
  kind: 'tool-result',
  id: 'm3#0',
  toolUseId: 't',
  isError: false,
  parts: [{ kind: 'text', text: 'ok' }],
};

async function createSubject(run?: Parameters<typeof buildRun>[0]) {
  const runRepository = new FakeRunRepository();
  if (run !== undefined) {
    await runRepository.insert(buildRun({ projectId: 'o/r', ticketNumber: 12, ...run }));
  }
  const runTranscripts = new FakeRunTranscripts();
  const sessionFeed = new FakeSessionFeed();
  const service = new RunQueryService({
    runRepository,
    recentRunSteps: new FakeRecentRunSteps(),
    runTranscripts,
    sessionFeed,
  });
  return { app: createSessionStreamRoutes(service), runTranscripts, sessionFeed };
}

function parseFrames(body: string) {
  return body
    .split('\n\n')
    .filter((chunk) => chunk.startsWith('data: '))
    .map((chunk) => sessionStreamFrameSchema.parse(JSON.parse(chunk.slice('data: '.length))));
}

const url = '/api/projects/o/r/tickets/12/session';

describe('createSessionStreamRoutes', () => {
  it('should stream the snapshot then ended when the run is finished', async () => {
    const { app, runTranscripts } = await createSubject({ state: 'ended' });
    runTranscripts.sessionEntries = [prompt, text, call, result];

    const response = await app.request(url);

    expect(response.headers.get('content-type')).toContain('text/event-stream');
    expect(parseFrames(await response.text())).toEqual([
      { kind: 'snapshot', entries: [prompt, text, call, result] },
      { kind: 'ended' },
    ]);
  });

  it('should stream live frames then ended when the run is active', async () => {
    const { app, runTranscripts, sessionFeed } = await createSubject({});
    runTranscripts.sessionEntries = [prompt];
    sessionFeed.publish('run-1', { kind: 'entry', entry: prompt });
    sessionFeed.publish('run-1', { kind: 'entry', entry: text });

    const response = await app.request(url);
    const body = response.text();
    await new Promise((resolve) => setTimeout(resolve, 20));
    sessionFeed.publish('run-1', { kind: 'text-delta', opensBlock: true, text: 'Hel' });
    sessionFeed.publish('run-1', { kind: 'entry', entry: call });
    sessionFeed.end('run-1');

    expect(parseFrames(await body)).toEqual([
      { kind: 'snapshot', entries: [prompt, text] },
      { kind: 'delta', opensBlock: true, text: 'Hel' },
      { kind: 'entry', entry: call },
      { kind: 'ended' },
    ]);
  });

  it('should stream no-session when the ticket has no run', async () => {
    const { app } = await createSubject();

    const response = await app.request(url);

    expect(parseFrames(await response.text())).toEqual([{ kind: 'no-session' }]);
  });

  it('should answer 400 with a message when the ticket number is bad', async () => {
    const { app } = await createSubject();

    const response = await app.request('/api/projects/o/r/tickets/abc/session');

    expect(response.status).toBe(400);
    expect(await response.json()).toHaveProperty('message');
  });

  it('should parse every frame kind with the exported schema', () => {
    const frames = [
      { kind: 'snapshot', entries: [] },
      { kind: 'no-session' },
      { kind: 'transcript-not-found' },
      { kind: 'entry', entry: { kind: 'text', id: 'a', text: 'b' } },
      { kind: 'delta', opensBlock: false, text: 'x' },
      { kind: 'ended' },
    ];

    expect(frames.map((frame) => sessionStreamFrameSchema.parse(frame))).toEqual(frames);
  });
});
