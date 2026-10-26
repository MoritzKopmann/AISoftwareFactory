import type { TicketImage } from './fetch-ticket-images.js';

type ImageWindowProps = {
  readonly images: readonly TicketImage[];
  readonly onOpen: (image: TicketImage) => void;
};

// One window per ticket page, so a fixed id stays unique.
const HEADING_ID = 'image-window-heading';

export function ImageWindow({ images, onOpen }: ImageWindowProps) {
  if (images.length === 0) return null;
  return (
    <section className="image-window" aria-labelledby={HEADING_ID}>
      <div className="iw-head">
        <h2 className="iw-title" id={HEADING_ID}>
          Images
        </h2>
        <span className="iw-count">{images.length}</span>
        <span className="iw-grow" />
        <span className="iw-where">.aisf/images/</span>
      </div>
      <div className="iw-body">
        <ul>
          {images.map((image) => (
            <li key={image.url}>
              <button
                type="button"
                className="img-tile"
                aria-label={`Open ${image.name} at full size`}
                onClick={() => {
                  onOpen(image);
                }}
              >
                <span className="img-thumb">
                  <img src={image.url} alt="" />
                </span>
                <span className="img-name">{image.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
