// Database connection client setup for Drizzle ORM and Postgres.
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';
import { env } from '../config/env.js';

const client = postgres(env.DATABASE_URL);
export const db = drizzle(client, { schema });
