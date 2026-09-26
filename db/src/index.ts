// Database client setup connecting to PostgreSQL via postgres-js.
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgrespassword@localhost:5432/datapilot';
const client = postgres(connectionString);

export const db = drizzle(client, { schema });
