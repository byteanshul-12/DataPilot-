// Environment variable validation using Zod.
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ path: '../.env' });

const envSchema = z.object({
  PORT: z.string().default('8000'),
  DATABASE_URL: z.string().default('postgresql://postgres:postgrespassword@localhost:5432/datapilot'),
  REDIS_URL: z.string().default('redis://localhost:6379/0'),
  CLERK_SECRET_KEY: z.string().optional(),
  CLERK_PUBLISHABLE_KEY: z.string().optional(),
  NODE_ENV: z.string().default('development'),
  GUEST_COOKIE_NAME: z.string().default('datapilot_guest_id'),
  GUEST_SESSION_TTL_DAYS: z.coerce.number().default(7),
});

export const env = envSchema.parse(process.env);
