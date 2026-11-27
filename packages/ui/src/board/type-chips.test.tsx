import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TypeChips } from './type-chips.js';

describe('TypeChips', () => {
  it('should render one chip span per chip in the given order when chips are given', () => {
    const markup = renderToStaticMarkup(
      <TypeChips
        chips={[
          { type: 'ui', label: 'UI' },
          { type: 'bug', label: 'BUG' },
        ]}
      />,
    );

    expect(markup).toBe('<span class="chip ui">UI</span><span class="chip bug">BUG</span>');
  });

  it('should render nothing when no chip is given', () => {
    const markup = renderToStaticMarkup(<TypeChips chips={[]} />);

    expect(markup).toBe('');
  });
});
