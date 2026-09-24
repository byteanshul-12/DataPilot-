// Express REST API application server initialization.
import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { tasksRouter } from './api/v1/tasks.js';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'healthy' });
});

app.use('/api/v1/tasks', tasksRouter);

app.listen(Number(env.PORT), () => {
  console.log(`Backend server listening on port ${env.PORT}`);
});
