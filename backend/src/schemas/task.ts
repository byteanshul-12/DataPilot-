// Zod validation schemas for collection task REST requests.
import { z } from 'zod';

export const createTaskSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required'),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
