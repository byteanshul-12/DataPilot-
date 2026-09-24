// Drizzle Kit configuration for PostgreSQL migration management.
import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

export default {
  schema: './src/schema.ts',
  out: './migrations',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgrespassword@localhost:5432/datapilot',
  },
} satisfies Config;
