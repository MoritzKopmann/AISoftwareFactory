import { z } from 'zod';

export const ticketNumberParameterSchema = z
  .string()
  .regex(/^[1-9]\d*$/, 'The ticket number must be a positive integer')
  .transform(Number)
  .refine(Number.isSafeInteger, 'The ticket number is too large');
