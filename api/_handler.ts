import express, { type Request, type Response, type NextFunction } from 'express';
import { apiRouter } from '../server/api';

// ===========================================================================
// Vercel Serverless Function SOURCE (bundled to a single CommonJS file)
// ===========================================================================
//
// WHY THIS FILE IS PREFIXED WITH `_`:
// Vercel's zero-config function detection ignores files and directories whose
// names start with an underscore. This file is therefore NOT compiled by
// Vercel into a multi-file serverless function. Instead, the project's own
// `buildCommand` (see vercel.json) runs esbuild to bundle THIS source into a
// single self-contained CommonJS file at `api/index.js`, and Vercel serves
// that bundled `.js` as the function.
//
// WHY BUNDLING (INSTEAD OF PER-DIRECTORY package.json PATCHING):
// Previously the function was the raw `api/index.ts`, which Vercel compiled
// into `api/index.js` while leaving its local imports (`../server/api`, which
// in turn imports `./db` and `../src/types`) as SEPARATE `.js` files. Those
// files live OUTSIDE `api/`, so they fall under the ROOT `package.json`
// (`"type": "module"`) and are treated as ES modules. But `api/index.js` is
// CommonJS (via `api/package.json` = `{"type":"commonjs"}`), so at runtime it
// did `require('../server/api.js')` against an ESM file and Node threw
// `ERR_REQUIRE_ESM`. Patching each directory with its own package.json is
// whack-a-mole (server/, then src/, then any transitive file).
//
// The robust fix: esbuild bundles ALL local project code (server/api.ts,
// server/db.ts, src/types.ts) INLINE into one CommonJS module. There is then
// NO runtime `require()` of any other project `.js` file, so the ESM/CJS
// boundary that produced `ERR_REQUIRE_ESM` cannot exist. `node_modules`
// packages (express, etc.) are kept EXTERNAL (`--packages=external`) because
// Vercel installs them, and CommonJS `require('express')` resolves them fine.
//
// ROUTING: `vercel.json` rewrites `/api/v1/(.*)` to this function. Depending
// on the runtime, the path seen inside the function may or may not still carry
// the `/api/v1` prefix, so we mount `apiRouter` at BOTH `/api/v1` and `/`.
//
// SAFETY: The entire import chain is in-memory only. No top-level await, no
// filesystem read at import, no `process.exit`, no throw at module load, so
// importing this module cannot crash the function cold start.

const app = express();

// Trust the Vercel proxy so `req.ip` / forwarded headers behave as expected.
app.set('trust proxy', true);

// Global middlewares (mirrors server.ts)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health checks (kept for parity with the standalone server). Registered under
// both prefixes for the same routing-robustness reason as the API router.
const healthLive = (_req: Request, res: Response) => {
  res.json({ status: 'live', timestamp: new Date().toISOString() });
};
const healthReady = (_req: Request, res: Response) => {
  res.json({ status: 'ready', timestamp: new Date().toISOString() });
};
app.get('/health/live', healthLive);
app.get('/health/ready', healthReady);
app.get('/api/v1/health/live', healthLive);
app.get('/api/v1/health/ready', healthReady);

// API v1 router. Mounted at BOTH the full base (`/api/v1`, matching server.ts
// and the case where Vercel preserves the rewrite source path) and the root
// (`/`, matching the case where Vercel forwards the path with the prefix
// stripped). Either way `/auth/login` resolves to `apiRouter.post('/auth/login')`.
app.use('/api/v1', apiRouter);
app.use('/', apiRouter);

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

// Export a handler in the canonical @vercel/node shape. The runtime always
// invokes the default export as `handler(req, res)`. An Express app IS a
// `(req, res)` handler, so we simply delegate to it.
export default function handler(req: Request, res: Response) {
  return app(req, res);
}
