import express from 'express';
import { apiRouter } from '../server/api';

// Vercel Serverless Function entrypoint.
//
// On Vercel the standalone `server.ts` (which mounts the API and serves the
// Vite build) is NOT executed - Vercel only serves the static `dist/` output.
// This function re-exposes the EXISTING Express API so that `/api/v1/*`
// requests keep working when deployed as a serverless function.
//
// `vercel.json` rewrites `/api/v1/(.*)` to this function, so the incoming
// request url is still `/api/v1/<route>`. We therefore mount `apiRouter` at
// the same `/api/v1` base used by `server.ts`, so the router's relative routes
// (e.g. `/auth/login`) resolve exactly as they do locally.
const app = express();

// Global middlewares (mirrors server.ts)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health checks (kept for parity with the standalone server)
app.get('/health/live', (_req, res) => {
  res.json({ status: 'live', timestamp: new Date().toISOString() });
});

app.get('/health/ready', (_req, res) => {
  res.json({ status: 'ready', timestamp: new Date().toISOString() });
});

// API v1 router - mounted at the same base as server.ts so that a request to
// `/api/v1/auth/login` matches `apiRouter.post('/auth/login', ...)`.
app.use('/api/v1', apiRouter);

// An Express app is itself a `(req, res)` handler, so it works directly as a
// Vercel Node serverless function handler.
export default app;
