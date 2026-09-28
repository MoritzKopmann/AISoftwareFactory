import { describe, expect, it } from 'vitest';
import type { ProjectResponse } from '@aisf/app/api-schemas/projects-schemas.js';
import { describeSidebarItems } from '../../src/projects/describe-sidebar-items.js';

function project(owner: string, name: string): ProjectResponse {
  return {
    id: `${owner}/${name}`,
    repository: { owner, name },
    checkoutPath: `/checkouts/${name}`,
    addedAt: '2026-01-01T00:00:00Z',
    contract: { passed: true, missingSlots: [], missingHeadings: [], missingKeys: [] },
  };
}

const projects = [project('acme', 'postcards'), project('acme', 'factory')];

describe('describeSidebarItems', () => {
  it('should describe one item per project with its name, tooltip and route when projects exist', () => {
    const description = describeSidebarItems(projects, { kind: 'home' });

    expect(description.projects).toEqual([
      {
        id: 'acme/postcards',
        label: 'postcards',
        title: 'acme/postcards',
        href: '#/projects/acme/postcards',
        current: false,
      },
      {
        id: 'acme/factory',
        label: 'factory',
        title: 'acme/factory',
        href: '#/projects/acme/factory',
        current: false,
      },
    ]);
    expect(description.addProject).toEqual({ href: '#/projects/new', current: false });
  });

  it('should mark the project current when the route is its project page', () => {
    const description = describeSidebarItems(projects, { kind: 'project', id: 'acme/factory' });

    expect(description.projects.map((item) => item.current)).toEqual([false, true]);
    expect(description.addProject.current).toBe(false);
  });

  it('should mark the project current when the route is one of its ticket pages', () => {
    const description = describeSidebarItems(projects, {
      kind: 'ticket',
      id: 'acme/postcards',
      number: 7,
    });

    expect(description.projects.map((item) => item.current)).toEqual([true, false]);
  });

  it('should mark Add project current when the route is the add-project page', () => {
    const description = describeSidebarItems(projects, { kind: 'add-project' });

    expect(description.projects.map((item) => item.current)).toEqual([false, false]);
    expect(description.addProject.current).toBe(true);
  });

  it('should describe no project items when there are no projects', () => {
    expect(describeSidebarItems([], { kind: 'home' }).projects).toEqual([]);
  });
});
