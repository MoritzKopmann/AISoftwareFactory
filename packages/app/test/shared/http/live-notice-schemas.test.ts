import { describe, expect, it } from 'vitest';
import { liveNoticeSchema } from '../../../src/shared/http/schemas/live-notice-schemas.js';

describe('liveNoticeSchema', () => {
  it('should parse when a watch.updated notice has no changed and no polledAt', () => {
    expect(liveNoticeSchema.safeParse({ event: 'watch.updated', projectId: 'p' }).success).toBe(
      true,
    );
  });

  it('should keep changed and polledAt when a notice carries them', () => {
    const notice = { event: 'watch.updated', projectId: 'p', changed: true, polledAt: 'T' };
    expect(liveNoticeSchema.parse(notice)).toEqual(notice);
  });
});
