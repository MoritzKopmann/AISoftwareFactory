import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { LiveConnection, LiveUpdates } from '../../src/live/live-updates.js';
import { OfflineHint } from '../../src/live/offline-hint.js';

const ignore = () => undefined;

function liveUpdatesIn(connection: LiveConnection): LiveUpdates {
  return { listen: () => ignore, connection: () => connection };
}

describe('OfflineHint', () => {
  it('should render the label and the refresh text in a status region when the connection is offline', () => {
    const markup = renderToStaticMarkup(<OfflineHint liveUpdates={liveUpdatesIn('offline')} />);

    expect(markup).toContain('role="status"');
    expect(markup).toContain('○');
    expect(markup).toContain('Offline');
    expect(markup).toContain('Views refresh when the connection is back.');
  });

  it.each(['open', 'connecting', 'paused'] as const)(
    'should render nothing when the connection is %s',
    (connection) => {
      expect(renderToStaticMarkup(<OfflineHint liveUpdates={liveUpdatesIn(connection)} />)).toBe(
        '',
      );
    },
  );
});
