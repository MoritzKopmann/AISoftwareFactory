import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Banner } from '../../src/shared/banner.js';

describe('Banner', () => {
  it('should render shape, message, command, hint and detail in that order when all are given', () => {
    const markup = renderToStaticMarkup(
      <Banner
        tone="danger"
        message="Can't reach GitHub"
        command="gh auth login"
        hint="The board refreshes by itself."
        detail="HTTP 401"
      />,
    );

    const positions = [
      '■',
      'Can&#x27;t reach GitHub',
      'gh auth login',
      'refreshes by itself',
      'HTTP 401',
    ].map((part) => markup.indexOf(part));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((first, second) => first - second));
  });

  it('should use role status when the tone is info or warn', () => {
    for (const tone of ['info', 'warn'] as const) {
      const markup = renderToStaticMarkup(<Banner tone={tone} message="Checking" />);
      expect(markup).toContain('role="status"');
      expect(markup).not.toContain('role="alert"');
    }
  });

  it('should use role alert when the tone is danger', () => {
    const markup = renderToStaticMarkup(<Banner tone="danger" message="Broken" />);
    expect(markup).toContain('role="alert"');
    expect(markup).not.toContain('role="status"');
  });

  it('should render the tone shape when the tone is info, warn or danger', () => {
    expect(renderToStaticMarkup(<Banner tone="info" message="m" />)).toContain('●');
    expect(renderToStaticMarkup(<Banner tone="warn" message="m" />)).toContain('▲');
    expect(renderToStaticMarkup(<Banner tone="danger" message="m" />)).toContain('■');
  });

  it('should leave out command, hint and detail when they are absent', () => {
    const markup = renderToStaticMarkup(<Banner tone="warn" message="Only a message" />);
    expect(markup).not.toContain('class="cmd"');
    expect(markup).not.toContain('class="sm"');
    expect(markup).not.toContain('class="sm mono"');
  });

  it('should pulse the shape when pulses is set', () => {
    const pulsing = renderToStaticMarkup(<Banner tone="info" message="m" pulses />);
    const still = renderToStaticMarkup(<Banner tone="info" message="m" />);
    expect(pulsing).toContain('shape pulse');
    expect(still).not.toContain('pulse');
  });

  it('should render a Copy button and an empty status when a command is given', () => {
    const markup = renderToStaticMarkup(
      <Banner tone="danger" message="m" command="gh auth login" />,
    );
    expect(markup).toContain('>Copy</button>');
    expect(markup).toMatch(/<span class="vh" role="status"><\/span>/);
  });
});
