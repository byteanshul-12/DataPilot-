// Environment variable validation using Zod.
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ path: '../.env' });

const envSchema = z.object({
  PORT: z.string().default('8000'),
  DATABASE_URL: z.string().default('postgresql://postgres:postgrespassword@localhost:5432/datapilot'),
  REDIS_URL: z.string().default('redis://localhost:6379/0'),
  BETTER_AUTH_SECRET: z.string().default('default_better_auth_secret_datapilot_key_32_chars'),
  BETTER_AUTH_URL: z.string().default('http://localhost:8000'),
  NODE_ENV: z.string().default('development'),
  GUEST_COOKIE_NAME: z.string().default('datapilot_guest_id'),
  GUEST_SESSION_TTL_DAYS: z.coerce.number().default(7),
});

export const env = envSchema.parse(process.env);
