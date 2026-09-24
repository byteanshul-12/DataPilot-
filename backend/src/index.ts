// Express REST API server bootstrap and route registrations.
import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { v1Router } from './api/v1/index.js';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.use('/api/v1', v1Router);

app.listen(Number(env.PORT), () => {
  console.log(`Backend server running on port ${env.PORT}`);
});
