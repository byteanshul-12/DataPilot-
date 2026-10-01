// Express REST API server bootstrap and route registrations.
import express from 'express';
import cors from 'cors';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './auth/better-auth.js';
import { env } from './config/env.js';
import { v1Router } from './api/v1/index.js';
import { parseCookies } from './auth/cookie.js';
import { initDatabase } from './db/migrate.js';
import { startKeepAlive } from './services/keepAlive.js';

const app = express();

app.set('trust proxy', 1);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const configured = process.env.BACKEND_CORS_ORIGINS ? process.env.BACKEND_CORS_ORIGINS.split(',').map(s => s.trim()) : [];
      if (
        origin.includes('localhost') ||
        origin.endsWith('.onrender.com') ||
        configured.includes(origin)
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);

// Better Auth MUST be mounted BEFORE express.json() body parser.
// Body parsers consume the request stream, preventing Better Auth from
// reading the request body for OAuth callbacks, sign-in, sign-up, etc.
app.all('/api/auth/*', toNodeHandler(auth));

app.use(express.json());

// Attach parsed cookies to request object.
app.use((req, _res, next) => {
  req.cookies = parseCookies(req);
  next();
});

app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Redirect root and any non-API browser navigation to the frontend.
// If Better Auth sends an error (e.g. ?error=state_not_found after an OAuth
// cold-start failure), forward the user to the sign-in page so they can retry
// instead of landing silently on the marketing page.
app.get('/', (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || 'https://datapilot-frontend-e6gi.onrender.com';
  const hasError = req.query.error;
  if (hasError) {
    // Auth error — send to sign-in so the user can try again
    return res.redirect(`${frontendUrl}/auth/sign-in?error=${encodeURIComponent(String(req.query.error))}`);
  }
  res.redirect(frontendUrl);
});

app.use('/api/v1', v1Router);

// Catch-all: redirect any other unknown browser paths to the frontend SPA.
// Skip actual API and health paths to avoid masking 404 errors.
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/health')) {
    return next();
  }
  const frontendUrl = process.env.FRONTEND_URL || 'https://datapilot-frontend-e6gi.onrender.com';
  res.redirect(`${frontendUrl}${req.originalUrl}`);
});

await initDatabase();

app.listen(Number(env.PORT), () => {
  console.log(`Backend server running on port ${env.PORT}`);
  startKeepAlive(); // Keep AI microservice warm to avoid Render free-tier cold starts
});
