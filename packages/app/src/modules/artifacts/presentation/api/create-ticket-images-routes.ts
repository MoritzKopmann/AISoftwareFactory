import { Hono } from 'hono';
import { getMimeType } from 'hono/utils/mime';
import { ticketNumberParameterSchema } from '../../../../shared/http.js';
import type { TicketImageService } from '../../business/service/ticket-image-service.js';
import { toTicketImagesResponse } from '../dto/mapper/image-mapper.js';

const UNKNOWN_MIME_TYPE = 'application/octet-stream';
const SVG_MIME_TYPE = 'image/svg+xml';
const svgContentSecurityPolicy = "default-src 'none'; style-src 'unsafe-inline'";

export function createTicketImagesRoutes(ticketImageService: TicketImageService): Hono {
  return new Hono()
    .get('/:owner/:name/tickets/:number/images', async (context) => {
      const parsedNumber = ticketNumberParameterSchema.safeParse(context.req.param('number'));
      if (!parsedNumber.success) {
        return context.json({ message: parsedNumber.error.issues[0]?.message }, 400);
      }
      const projectId = `${context.req.param('owner')}/${context.req.param('name')}`;
      const imageNames = await ticketImageService.list(projectId, parsedNumber.data);
      return context.json(toTicketImagesResponse(projectId, parsedNumber.data, imageNames));
    })
    .get('/:owner/:name/tickets/:number/images/:image', async (context) => {
      const parsedNumber = ticketNumberParameterSchema.safeParse(context.req.param('number'));
      if (!parsedNumber.success) {
        return context.json({ message: parsedNumber.error.issues[0]?.message }, 400);
      }
      const imageName = context.req.param('image');
      const image = await ticketImageService.read(
        `${context.req.param('owner')}/${context.req.param('name')}`,
        parsedNumber.data,
        imageName,
      );
      if (image === undefined) {
        return context.json({ message: 'Unknown image' }, 404);
      }
      const mimeType = getMimeType(imageName) ?? UNKNOWN_MIME_TYPE;
      return context.body(image.bytes as Uint8Array<ArrayBuffer>, 200, {
        'Content-Type': mimeType,
        'X-Content-Type-Options': 'nosniff',
        ...(mimeType.startsWith(SVG_MIME_TYPE)
          ? { 'Content-Security-Policy': svgContentSecurityPolicy }
          : {}),
      });
    });
}
