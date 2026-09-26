// Express REST API server bootstrap and route registrations.
import express from 'express';
import cors from 'cors';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './auth/better-auth.js';
import { env } from './config/env.js';
import { v1Router } from './api/v1/index.js';
import { parseCookies } from './auth/cookie.js';

const app = express();

app.use(
  cors({
    origin: process.env.BACKEND_CORS_ORIGINS || 'http://localhost:5173',
    credentials: true,
  })
);

app.use(express.json());

// Attach parsed cookies to request object.
app.use((req, _res, next) => {
  req.cookies = parseCookies(req);
  next();
});

// Better Auth API route handler for authentication endpoints.
app.all('/api/auth/*', toNodeHandler(auth));

app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.use('/api/v1', v1Router);

app.listen(Number(env.PORT), () => {
  console.log(`Backend server running on port ${env.PORT}`);
});
