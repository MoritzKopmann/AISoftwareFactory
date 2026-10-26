import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { TicketImage } from './fetch-ticket-images.js';
import { ImageViewer } from './image-viewer.js';

const ignoreClose = () => undefined;
const longName = 'greeter-full-list-sixth-greeting-drops-the-oldest-light.png';
const image: TicketImage = { name: longName, url: `/api/projects/p/tickets/7/images/${longName}` };

describe('ImageViewer', () => {
  it('should label the dialog by a heading holding the full file name when an image is open', () => {
    const markup = renderToStaticMarkup(<ImageViewer image={image} onClose={ignoreClose} />);

    const labelledBy = /<dialog[^>]*aria-labelledby="([^"]+)"/.exec(markup)?.[1];
    expect(labelledBy).toBeDefined();
    expect(markup).toMatch(new RegExp(`<h2[^>]*id="${labelledBy ?? ''}"[^>]*>${longName}</h2>`));
  });

  it('should show the image from its url with the file name as alt when an image is open', () => {
    const markup = renderToStaticMarkup(<ImageViewer image={image} onClose={ignoreClose} />);

    expect(markup).toMatch(new RegExp(`<img src="${image.url}" alt="${longName}"`));
  });

  it('should offer a Close button with a hidden ✕ glyph that closes the dialog when an image is open', () => {
    const markup = renderToStaticMarkup(<ImageViewer image={image} onClose={ignoreClose} />);

    const form = /<form method="dialog"[^>]*>([\s\S]*?)<\/form>/.exec(markup)?.[1] ?? '';
    expect(form).toMatch(/<button[^>]*type="submit"[^>]*>[\s\S]*<\/button>/);
    expect(form).toContain('<span class="iv-glyph" aria-hidden="true">✕</span>Close');
  });

  it('should show the dialog as a modal when it mounts', () => {
    const node = { open: false, showModal: vi.fn() };
    const dialog = findDialog(ImageViewer({ image, onClose: ignoreClose }));

    dialog?.props.ref?.(node);

    expect(node.showModal).toHaveBeenCalledOnce();
  });

  it('should call onClose when the dialog closes', () => {
    const onClose = vi.fn();
    const dialog = findDialog(ImageViewer({ image, onClose }));

    dialog?.props.onClose?.();

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('should close the dialog when a click lands on the backdrop outside its box', () => {
    const { node, click } = buildDialogClick({ clientX: 10, clientY: 10 });
    const dialog = findDialog(ImageViewer({ image, onClose: ignoreClose }));

    dialog?.props.onClick?.(click);

    expect(node.close).toHaveBeenCalledOnce();
  });

  it('should keep the dialog open when a click on it lands inside its box', () => {
    const { node, click } = buildDialogClick({ clientX: 24, clientY: 300 });
    const dialog = findDialog(ImageViewer({ image, onClose: ignoreClose }));

    dialog?.props.onClick?.(click);

    expect(node.close).not.toHaveBeenCalled();
  });
});

type DialogProps = {
  readonly children?: ReactNode;
  readonly ref?: (node: unknown) => void;
  readonly onClose?: () => void;
  readonly onClick?: (click: unknown) => void;
};

// The dialog's box is inset 24px in a 1000 × 800 viewport.
function buildDialogClick(point: { readonly clientX: number; readonly clientY: number }) {
  const node = {
    close: vi.fn(),
    getBoundingClientRect: () => ({ left: 24, top: 24, right: 976, bottom: 776 }),
  };
  return { node, click: { ...point, target: node, currentTarget: node } };
}

function findDialog(node: ReactNode): ReactElement<DialogProps> | undefined {
  if (Array.isArray(node)) return node.map(findDialog).find((found) => found !== undefined);
  if (!isValidElement<DialogProps>(node)) return undefined;
  if (node.type === 'dialog') return node;
  return findDialog(node.props.children);
}
