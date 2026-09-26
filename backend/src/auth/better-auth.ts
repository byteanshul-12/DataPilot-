// Better Auth instance configuration and session validation helper.
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { Request } from 'express';
import { db } from '../db/index.js';
import * as schema from '../db/schema.js';
import { env } from '../config/env.js';
import { UserIdentity } from './types.js';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
  }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
    },
    apple: {
      clientId: process.env.APPLE_CLIENT_ID || '',
      clientSecret: process.env.APPLE_CLIENT_SECRET || '',
    },
  },
});

export async function getBetterAuthIdentity(req: Request): Promise<UserIdentity | null> {
  try {
    const sessionData = await auth.api.getSession({
      headers: req.headers as Record<string, string>,
    });

    if (!sessionData || !sessionData.user) {
      return null;
    }

    return {
      type: 'user',
      userId: sessionData.user.id,
      email: sessionData.user.email,
      name: sessionData.user.name,
    };
  } catch (error) {
    return null;
  }
}
