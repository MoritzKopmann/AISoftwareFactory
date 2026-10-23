import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ProjectResponse } from '@aisf/app/api-schemas/projects-schemas.js';
import type { UsageState } from '../usage/use-usage.js';
import { ProjectSidebar } from './project-sidebar.js';

const loadingUsage: UsageState = { kind: 'loading' };

function render(
  projects: ReadonlyArray<ProjectResponse> | undefined,
  {
    usage = loadingUsage,
    isUsageCurrent = false,
  }: { usage?: UsageState; isUsageCurrent?: boolean } = {},
): string {
  return renderToStaticMarkup(
    <ProjectSidebar
      projects={projects}
      route={{ kind: 'home' }}
      usage={usage}
      isUsageCurrent={isUsageCurrent}
    />,
  );
}

describe('ProjectSidebar', () => {
  it('should show the usage link when projects are still loading', () => {
    const markup = render(undefined);

    expect(markup).toContain('href="#/usage"');
  });

  it('should show the usage link after the project list when projects are loaded', () => {
    const markup = render([]);

    expect(markup.indexOf('href="#/usage"')).toBeGreaterThan(markup.indexOf('+ Add project'));
  });

  it('should mark the usage link as the current page when current', () => {
    const markup = render([], { isUsageCurrent: true });

    expect(markup).toMatch(/<a[^>]*href="#\/usage"[^>]*aria-current="page"/);
  });

  it('should not mark the usage link as the current page when not current', () => {
    const markup = render([]);

    expect(markup).not.toContain('aria-current');
  });

  it('should mark the usage link as the current page when usage failed and current', () => {
    const markup = render(undefined, { usage: { kind: 'failed' }, isUsageCurrent: true });

    expect(markup).toMatch(/<a[^>]*href="#\/usage"[^>]*aria-current="page"/);
  });
});
