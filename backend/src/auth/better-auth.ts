// Better Auth instance configuration and session validation helper.
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { Request } from 'express';
import { db } from '../db/index.js';
import * as schema from '../db/schema.js';
import { env } from '../config/env.js';
import { UserIdentity } from './types.js';
import { sendPasswordResetEmail, sendVerificationEmail } from '../services/emailService.js';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
  }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: [
    'http://localhost:5173',
    process.env.BACKEND_CORS_ORIGINS || '',
  ].filter(Boolean),
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail({ to: user.email, url });
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail({ to: user.email, url });
    },
  },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '',
    },
    github: {
      clientId: env.GITHUB_CLIENT_ID || process.env.GITHUB_CLIENT_ID || '',
      clientSecret: env.GITHUB_CLIENT_SECRET || process.env.GITHUB_CLIENT_SECRET || '',
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
