import express, { type Request, type Response, type NextFunction } from 'express';
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
app.get('/health/live', (_req: Request, res: Response) => {
  res.json({ status: 'live', timestamp: new Date().toISOString() });
});

app.get('/health/ready', (_req: Request, res: Response) => {
  res.json({ status: 'ready', timestamp: new Date().toISOString() });
});

// API v1 router - mounted at the same base as server.ts so that a request to
// `/api/v1/auth/login` matches `apiRouter.post('/auth/login', ...)`.
app.use('/api/v1', apiRouter);

// Any unmatched path returns a JSON 404 the frontend can parse (avoids an
// opaque HTML/empty body that surfaces as an unhelpful error in the UI).
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
});

// Top-level error handler: any thrown error (sync or forwarded via next(err))
// is returned as JSON with HTTP 500 instead of an opaque crash, so the
// frontend gets a parseable body rather than a bare 500.
// NOTE: Express identifies an error handler by its 4-argument signature, so
// `next` must be kept even though it is unused.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : 'Internal error';
  // eslint-disable-next-line no-console
  console.error('[api/index] Unhandled error:', err);
  res.status(500).json({ error: { code: 'INTERNAL', message } });
});

// Export a handler function that delegates to the Express app. Exporting a
// plain function (rather than the raw `app`) is the most broadly compatible
// form for the `@vercel/node` runtime: the runtime always invokes the default
// export as `handler(req, res)`, and a raw Express `app` can fail to be
// recognised/invoked correctly on some runtime versions, producing a 500.
export default (req: Request, res: Response) => app(req, res);
