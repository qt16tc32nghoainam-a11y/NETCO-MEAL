import express, { type Request, type Response, type NextFunction } from 'express';
import { apiRouter } from '../server/api';

// ===========================================================================
// Vercel Serverless Function entrypoint (CommonJS)
// ===========================================================================
//
// DEPENDENCIES: We intentionally do NOT add `@vercel/node` as a new dependency.
// The committed `bun.lock` is written by a newer Bun than the toolchain here
// and cannot be regenerated offline (INTEGRATIONS_ONLY blocks the registry).
// Adding an unlocked dependency risks a frozen-lockfile install failure on
// Vercel, which would be a NEW failure mode. The `@vercel/node` runtime invokes
// the default export as `handler(req, res)` regardless of its TypeScript types,
// and an Express app is already a valid `(req, res)` handler, so the express
// types shipped via `@types/express` are sufficient for a correct runtime.
//
// MODULE SYSTEM: This function is compiled as CommonJS (see api/tsconfig.json:
// "module": "CommonJS"). The rest of the repo runs through Vite/tsx which is
// ESM, but the serverless function is an ISOLATED build target that @vercel/node
// compiles on its own using this local tsconfig. We deliberately keep it
// CommonJS because every relative import in the server chain
// (../server/api -> ./db -> ../src/types) is EXTENSIONLESS. Node ESM
// (NodeNext) would require explicit `.js` extensions on all of those imports,
// which the codebase does not use; forcing ESM would break resolution at
// invocation time and produce exactly the HTTP 500 we are fixing. CommonJS
// resolves extensionless relative imports natively, so this is the safe,
// standard choice.
//
// ROUTING: On Vercel, `vercel.json` rewrites `/api/v1/(.*)` to this function.
// Depending on the runtime, the request path seen inside the function may or
// may not still include the `/api/v1` prefix. To be robust to BOTH cases we
// mount `apiRouter` at `/api/v1` AND at `/`, so a request for `/auth/login`
// (prefix stripped) and `/api/v1/auth/login` (prefix preserved) both reach the
// router's `/auth/login` handler. This removes the most common cause of a
// silent 404/500 mismatch.
//
// SAFETY: The entire import chain is in-memory only. There is no top-level
// `await`, no filesystem read, no `process.exit`, and no throw at module load,
// so importing this module cannot crash the function cold start. Static assets
// (the Vite `dist/` build) are served by Vercel directly and are NOT the
// responsibility of this function.

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
// `(req, res)` handler, so we simply delegate to it. Wrapping it in a named
// function (rather than exporting the raw `app`) is the most broadly compatible
// form across @vercel/node runtime versions and avoids interop edge cases where
// a raw Express `app` default export is not recognised/invoked correctly.
export default function handler(req: Request, res: Response) {
  return app(req, res);
}
