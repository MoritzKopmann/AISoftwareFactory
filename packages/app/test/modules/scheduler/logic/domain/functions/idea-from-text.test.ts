import { describe, expect, it } from 'vitest';
import { ideaFromText } from '../../../../../../src/modules/scheduler/logic/domain/functions/idea-from-text.js';

describe('ideaFromText', () => {
  it('should use the text as title with an empty body when it is a short one-liner', () => {
    expect(ideaFromText('Export trips as postcards')).toEqual({
      title: 'Export trips as postcards',
      body: '',
    });
  });

  it('should cut the title at a word before 80 characters and keep the text as body when the one-liner is long', () => {
    const text = `${'word '.repeat(20)}end`;

    expect(ideaFromText(text)).toEqual({
      title: `${'word '.repeat(16).trimEnd()}…`,
      body: text,
    });
  });

  it('should use the first line as title and keep the text as body when the text has several lines', () => {
    const text = 'Export trips as postcards\n\nUsers pick a trip and get a printable card.';

    expect(ideaFromText(text)).toEqual({ title: 'Export trips as postcards', body: text });
  });

  it('should cut the title mid-word when the first line has no space before 80 characters', () => {
    const text = 'x'.repeat(100);

    expect(ideaFromText(text)).toEqual({ title: `${'x'.repeat(79)}…`, body: text });
  });
});
