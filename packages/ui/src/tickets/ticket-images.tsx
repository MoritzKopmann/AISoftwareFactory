import { useState } from 'react';
import type { TicketImage } from './fetch-ticket-images.js';
import { ImageViewer } from './image-viewer.js';
import { ImageWindow } from './image-window.js';

type TicketImagesProps = {
  readonly images: readonly TicketImage[];
};

export function TicketImages({ images }: TicketImagesProps) {
  const [openedImage, setOpenedImage] = useState<TicketImage>();
  return (
    <>
      <ImageWindow images={images} onOpen={setOpenedImage} />
      {openedImage !== undefined && (
        <ImageViewer
          image={openedImage}
          onClose={() => {
            setOpenedImage(undefined);
          }}
        />
      )}
    </>
  );
}
