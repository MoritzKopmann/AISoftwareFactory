import { isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { TicketImage } from './fetch-ticket-images.js';
import { ImageWindow } from './image-window.js';

const ignoreOpen = () => undefined;

function anImage(name: string): TicketImage {
  return { name, url: `/api/projects/p/tickets/7/images/${name}` };
}

describe('ImageWindow', () => {
  it('should render nothing when there are no images', () => {
    expect(renderToStaticMarkup(<ImageWindow images={[]} onOpen={ignoreOpen} />)).toBe('');
  });

  it('should head a section labelled Images with the count and the folder when images exist', () => {
    const images = [anImage('a.png'), anImage('b.png')];

    const markup = renderToStaticMarkup(<ImageWindow images={images} onOpen={ignoreOpen} />);

    const labelledBy = /<section[^>]*aria-labelledby="([^"]+)"/.exec(markup)?.[1];
    expect(labelledBy).toBeDefined();
    expect(markup).toMatch(new RegExp(`<h2[^>]*id="${labelledBy ?? ''}"[^>]*>Images</h2>`));
    const head = ['>Images<', '>2<', '>.aisf/images/<'].map((part) => markup.indexOf(part));
    expect(head.every((position) => position >= 0)).toBe(true);
    expect(head).toEqual([...head].sort((first, second) => first - second));
  });

  it('should show one named button per image with its thumbnail and full name in the given order when images exist', () => {
    const longName = 'greeter-full-list-sixth-greeting-drops-the-oldest-light.png';
    const images = [anImage('b.png'), anImage(longName)];

    const markup = renderToStaticMarkup(<ImageWindow images={images} onOpen={ignoreOpen} />);

    const tiles = [...markup.matchAll(/<button type="button"[^>]*>[\s\S]*?<\/button>/g)].map(
      (match) => match[0],
    );
    expect(tiles).toHaveLength(2);
    expect(tiles[0]).toContain('aria-label="Open b.png at full size"');
    expect(tiles[0]).toContain('<img src="/api/projects/p/tickets/7/images/b.png" alt=""/>');
    expect(tiles[0]).toContain('>b.png<');
    expect(tiles[1]).toContain(`aria-label="Open ${longName} at full size"`);
    expect(tiles[1]).toContain(`>${longName}<`);
  });

  it('should call onOpen with that image when its tile is activated', () => {
    const images = [anImage('a.png'), anImage('b.png')];
    const onOpen = vi.fn();
    const tree = ImageWindow({ images, onOpen });

    findTileClicks(tree)[1]?.();

    expect(onOpen).toHaveBeenCalledExactlyOnceWith(images[1]);
  });
});

function findTileClicks(node: ReactNode): readonly (() => void)[] {
  if (Array.isArray(node)) return node.flatMap(findTileClicks);
  if (!isValidElement<{ children?: ReactNode; onClick?: () => void }>(node)) return [];
  if (node.type === 'button' && node.props.onClick !== undefined) return [node.props.onClick];
  return findTileClicks(node.props.children);
}
