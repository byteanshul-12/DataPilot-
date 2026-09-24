// API v1 main router index aggregating service modules.
import { Router } from 'express';
import { workflowsRouter } from './workflows.js';
import { datasetsRouter } from './datasets.js';
import { sourcesRouter } from './sources.js';
import { dashboardRouter } from './dashboard.js';

export const v1Router = Router();

v1Router.use('/workflows', workflowsRouter);
v1Router.use('/datasets', datasetsRouter);
v1Router.use('/sources', sourcesRouter);
v1Router.use('/dashboard', dashboardRouter);
