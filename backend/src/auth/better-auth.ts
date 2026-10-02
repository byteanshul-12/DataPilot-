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
  baseURL: env.BETTER_AUTH_URL.startsWith('http') ? env.BETTER_AUTH_URL : `https://${env.BETTER_AUTH_URL}`,
  trustedOrigins: [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:*',
    'https://*.onrender.com',
    '*.onrender.com',
    'https://datapilot-frontend-e6gi.onrender.com',
    process.env.FRONTEND_URL || '',
    ...(process.env.BACKEND_CORS_ORIGINS ? process.env.BACKEND_CORS_ORIGINS.split(',').map((s) => s.trim()) : []),
  ].filter(Boolean),
  account: {
    accountLinking: {
      enabled: true,
    },
    // Cross-site OAuth (Safari ITP / Chrome third-party cookie blocking):
    // Verifies state cryptographically via PostgreSQL verification table
    // without requiring Safari to send a cross-origin state cookie.
    skipStateCookieCheck: true,
  },
  advanced: {
    disableCSRFCheck: true,
    defaultCookieAttributes: {
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      secure: process.env.NODE_ENV === 'production',
      partitioned: true,
    },
  },
  // Redirect auth errors to the frontend sign-in page instead of the backend root
  onAPIError: {
    errorURL: `${process.env.FRONTEND_URL || 'https://datapilot-frontend-e6gi.onrender.com'}/auth/sign-in`,
  },
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
