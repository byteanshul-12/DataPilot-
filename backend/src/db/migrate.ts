import { client } from './index.js';

export async function initDatabase() {
  try {
    console.log('[DB] Ensuring database tables exist...');
    await client`
      CREATE TABLE IF NOT EXISTS "user" (
        id text PRIMARY KEY,
        name text NOT NULL,
        email text NOT NULL UNIQUE,
        email_verified boolean NOT NULL DEFAULT false,
        image text,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
    `;

    await client`
      CREATE TABLE IF NOT EXISTS "session" (
        id text PRIMARY KEY,
        expires_at timestamp NOT NULL,
        token text NOT NULL UNIQUE,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        ip_address text,
        user_agent text,
        user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
      );
    `;

    await client`
      CREATE TABLE IF NOT EXISTS "account" (
        id text PRIMARY KEY,
        account_id text NOT NULL,
        provider_id text NOT NULL,
        user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        access_token text,
        refresh_token text,
        id_token text,
        access_token_expires_at timestamp,
        refresh_token_expires_at timestamp,
        scope text,
        password text,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
    `;

    await client`
      CREATE TABLE IF NOT EXISTS "verification" (
        id text PRIMARY KEY,
        identifier text NOT NULL,
        value text NOT NULL,
        expires_at timestamp NOT NULL,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );
    `;

    await client`
      CREATE TABLE IF NOT EXISTS "guest_sessions" (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        guest_id text NOT NULL UNIQUE,
        expires_at timestamp NOT NULL,
        created_at timestamp NOT NULL DEFAULT now()
      );
    `;

    await client`
      CREATE TABLE IF NOT EXISTS "guest_data" (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        guest_id text NOT NULL REFERENCES guest_sessions(guest_id) ON DELETE CASCADE,
        data_type text NOT NULL,
        data jsonb NOT NULL,
        created_at timestamp NOT NULL DEFAULT now()
      );
    `;

    await client`
      CREATE TABLE IF NOT EXISTS "collection_tasks" (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        prompt text NOT NULL,
        status text NOT NULL DEFAULT 'pending',
        result_count integer DEFAULT 0,
        plan_response text,
        ai_response text,
        execution_steps jsonb,
        progress integer DEFAULT 0,
        user_id text REFERENCES "user"(id) ON DELETE CASCADE,
        guest_id text,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
    `;

    await client`
      CREATE TABLE IF NOT EXISTS "collection_results" (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id uuid REFERENCES collection_tasks(id) ON DELETE CASCADE,
        source_url text,
        domain text,
        data jsonb NOT NULL,
        created_at timestamp NOT NULL DEFAULT now()
      );
    `;

    console.log('[DB] Database tables verified and initialized successfully.');
  } catch (error) {
    console.error('[DB] Failed to initialize database schema:', error);
  }
}
