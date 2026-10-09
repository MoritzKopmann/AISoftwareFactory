import { isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Banner } from '../../src/shared/banner.js';

function findRetryButtonClick(node: ReactNode): (() => void) | undefined {
  if (Array.isArray(node)) {
    return node.map(findRetryButtonClick).find((click) => click !== undefined);
  }
  if (!isValidElement<{ children?: ReactNode; onClick?: () => void }>(node)) return undefined;
  if (node.type === 'button' && node.props.children === 'Retry') return node.props.onClick;
  return findRetryButtonClick(node.props.children);
}

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

  it('should render a Retry button when onRetry is given', () => {
    const markup = renderToStaticMarkup(<Banner tone="warn" message="m" onRetry={() => {}} />);
    expect(markup).toContain('<button class="btn" type="button">Retry</button>');
  });

  it('should render no Retry button when onRetry is absent', () => {
    const markup = renderToStaticMarkup(<Banner tone="warn" message="m" />);
    expect(markup).not.toContain('Retry');
  });

  it('should place Retry after the hint and before the detail when all are given', () => {
    const markup = renderToStaticMarkup(
      <Banner tone="warn" message="m" hint="the hint" detail="the detail" onRetry={() => {}} />,
    );
    const positions = ['the hint', '>Retry<', 'the detail'].map((part) => markup.indexOf(part));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((first, second) => first - second));
  });

  it('should call onRetry when the Retry button is clicked', () => {
    const onRetry = vi.fn();
    const click = findRetryButtonClick(Banner({ tone: 'warn', message: 'm', onRetry }));
    click?.();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
