import type { MouseEvent } from 'react';
import type { TicketImage } from './fetch-ticket-images.js';

type ImageViewerProps = {
  readonly image: TicketImage;
  readonly onClose: () => void;
};

// One viewer per ticket page, so a fixed id stays unique.
const HEADING_ID = 'image-viewer-heading';

export function ImageViewer({ image, onClose }: ImageViewerProps) {
  return (
    <dialog
      className="image-viewer"
      aria-labelledby={HEADING_ID}
      ref={showAsModal}
      onClose={onClose}
      onClick={closeOnBackdrop}
    >
      <div className="iv-head">
        <h2 className="iv-title" id={HEADING_ID}>
          {image.name}
        </h2>
        <form method="dialog">
          <button type="submit" className="btn iv-close">
            <span className="iv-glyph" aria-hidden="true">
              ✕
            </span>
            Close
          </button>
        </form>
      </div>
      <div className="iv-stage">
        <img src={image.url} alt={image.name} />
      </div>
    </dialog>
  );
}

function showAsModal(dialog: HTMLDialogElement | null) {
  if (isClosedDialog(dialog)) dialog.showModal();
}

function isClosedDialog(dialog: HTMLDialogElement | null): dialog is HTMLDialogElement {
  return dialog !== null && !dialog.open;
}

function closeOnBackdrop(click: MouseEvent<HTMLDialogElement>) {
  if (isOnBackdrop(click)) click.currentTarget.close();
}

// A click on the backdrop reaches the dialog with a point outside its box.
function isOnBackdrop(click: MouseEvent<HTMLDialogElement>): boolean {
  const box = click.currentTarget.getBoundingClientRect();
  return (
    click.clientX < box.left ||
    click.clientX > box.right ||
    click.clientY < box.top ||
    click.clientY > box.bottom
  );
}
