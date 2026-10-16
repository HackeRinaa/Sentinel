import type { z } from 'zod';
import { AppError } from '../errors/app-error.js';

interface Parser<T> {
  safeParse: (input: unknown) => { success: true; data: T } | { success: false; error: z.ZodError };
}

export function parseWithSchema<T>(schema: Parser<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Invalid request parameters',
      result.error.flatten(),
    );
  }
  return result.data;
}
