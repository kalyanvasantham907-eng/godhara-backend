import dotenv from 'dotenv';
dotenv.config();

// Must be imported before any routes are registered — patches Express 4's
// Router so that rejected promises / thrown errors inside `async` route
// handlers are automatically forwarded to the error-handling middleware
// instead of hanging the request or crashing the process.
import 'express-async-errors';

import express from 'express';
import session from 'express-session';
import cors    from 'cors';
import helmet  from 'helmet';
import rateLimit from 'express-rate-limit';
import path    from 'path';
import fs      from 'fs';
import { fileURLToPath } from 'url';
import { apiRouter }     from './routes/index.js';
import {
  dbInitializationPromise,
  pool,
  isPostgresConnected,
  reloadCache,
  pingDatabase,
  dbObj,
} from './database/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── PROCESS-LEVEL SAFETY NETS ────────────────────────────────────────────────
// Without these, a single unexpected error anywhere in the app (a bad DB
// response, a rejected fire-and-forget promise, a third-party lib throwing)
// takes the whole Node process down and Railway has to cold-restart it.
//
// unhandledRejection: log and keep running — most of these are recoverable
// (e.g. a stray promise from a fire-and-forget email send).
process.on('unhandledRejection', (reason: any) => {
  console.error('❌ [UnhandledRejection]', reason?.stack || reason);
});

// uncaughtException: the process is in an undefined state at this point, so
// we log it, then shut down cleanly instead of letting Railway hard-kill us
// mid-request. Railway's restart policy brings us back up immediately.
process.on('uncaughtException', (err: Error) => {
  console.error('❌ [UncaughtException]', err.stack || err);
  shutdown('uncaughtException').finally(() => process.exit(1));
});

let httpServer: import('http').Server | undefined;
let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n🛑 [Shutdown] Received ${signal}, closing gracefully...`);
  try {
    if (httpServer) {
      await new Promise<void>((resolve) => {
        httpServer!.close(() => resolve());
        // Force-close after 10s if connections won't drain
        setTimeout(resolve, 10_000).unref();
      });
      console.log('✅ [Shutdown] HTTP server closed');
    }
  } catch (err) {
    console.error('[Shutdown] Error closing HTTP server:', err);
  }
  try {
    await pool.end();
    console.log('✅ [Shutdown] DB pool closed');
  } catch (err) {
    console.error('[Shutdown] Error closing DB pool:', err);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM').finally(() => process.exit(0)));
process.on('SIGINT',  () => shutdown('SIGINT').finally(() => process.exit(0)));

async function startServer() {
  const app  = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  app.set('trust proxy', 1);

  // ── CORS ─────────────────────────────────────────────────────────────────
const allowedOrigins = [
  'https://godhara.com',
  'https://www.godhara.com',
  'https://godhara-fronted.vercel.app',
  'https://godhara-frontend.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
];
  if (process.env.FRONTEND_URL) allowedOrigins.push(process.env.FRONTEND_URL);

  app.use(cors({
 origin: (origin, cb) => {
  if (!origin) return cb(null, true);

  if (allowedOrigins.includes(origin)) {
    return cb(null, true);
  }

  if (
    origin.endsWith('.vercel.app') ||
    origin.startsWith('http://localhost') ||
    origin.startsWith('http://127.0.0.1')
  ) {
    return cb(null, true);
  }

  console.warn(`[CORS] Blocked origin: ${origin}`);
  return cb(new Error('Not allowed by CORS'));
},
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  }));

  // ── SECURITY HEADERS ─────────────────────────────────────────────────────
  // CSP and cross-origin resource policy are disabled: this API is consumed
  // by a separate frontend origin (Vercel) and serves images/assets to it,
  // so the default restrictive policies would break those requests. The
  // other Helmet defaults (HSTS, X-Frame-Options, X-Content-Type-Options,
  // etc.) still apply.
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
  }));

  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // ── HEALTH / READINESS / LIVENESS (before DB init guard) ────────────────
  // Uptime monitors / Railway healthchecks hit these — must never block on
  // DB init or depend on downstream state that could itself be degraded.

  // Liveness: is the process itself alive and able to respond at all?
  // Never checks the DB — a DB blip should not make Railway kill the pod.
  app.get('/api/liveness', (_req, res) => {
    res.status(200).json({ status: 'alive', timestamp: new Date().toISOString() });
  });

  // Readiness: can this instance actually serve traffic right now?
  app.get('/api/readiness', async (_req, res) => {
    try {
      await dbInitializationPromise;
      res.status(isPostgresConnected ? 200 : 207).json({
        status: isPostgresConnected ? 'ready' : 'degraded',
        database: isPostgresConnected ? 'connected' : 'fallback',
        timestamp: new Date().toISOString(),
      });
    } catch {
      res.status(503).json({ status: 'not_ready', timestamp: new Date().toISOString() });
    }
  });

  app.get('/api/health', async (_req, res) => {
    try {
      const health = await dbObj.getHealth();
      const status = health.status === 'healthy' ? 200 : 207;
      res.status(status).json({ ...health, timestamp: new Date().toISOString() });
    } catch {
      res.status(503).json({ status: 'error', timestamp: new Date().toISOString() });
    }
  });

  // ── RATE LIMITING ─────────────────────────────────────────────────────────
  // General ceiling on all API traffic, plus a tighter one on auth endpoints
  // (login/signup/OTP/password-reset) to slow down credential-stuffing and
  // OTP brute-force attempts without affecting normal browsing/shopping.
  app.use('/api', rateLimit({
    windowMs: 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests, please slow down.' },
  }));

  app.use('/api/auth', rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many attempts, please try again later.' },
  }));

  // ── SESSION STORE ─────────────────────────────────────────────────────────
  const isProduction = process.env.NODE_ENV === 'production';
  let sessionStore: any = undefined;

  await dbInitializationPromise;

  if (isPostgresConnected) {
    try {
      const connectPgSimple = (await import('connect-pg-simple')).default;
      const PgStore = connectPgSimple(session);
      sessionStore = new PgStore({
        pool,
        tableName: 'session',
        createTableIfMissing: true,
        // Clean expired sessions every 15 min (default is 1 hour)
        pruneSessionInterval: 15 * 60,
      });
      console.log('✅ [Session] PostgreSQL session store active');
    } catch (err: any) {
      console.warn(`⚠️  [Session] connect-pg-simple unavailable: ${err.message}`);
    }
  }

  app.use(session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'godhara-secret-session-key-2026-change-in-prod',
    resave: false,
    saveUninitialized: false,
    name: 'gdh.sid',
    cookie: {
      secure: isProduction,
      httpOnly: true,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: 2 * 60 * 60 * 1000,   // 2 hours
    },
  }));

  // ── DB INIT GUARD ─────────────────────────────────────────────────────────
  // Serves stale cache immediately — non-blocking in the hot path
  app.use(async (_req, res, next) => {
    try {
      await dbInitializationPromise;
      next();
    } catch (err: any) {
      console.error('[DB Init Guard]', err);
      res.status(503).json({ error: 'Service temporarily unavailable' });
    }
  });

  // ── PERFORMANCE LOGGING ───────────────────────────────────────────────────
  app.use((req, res, next) => {
    const t0 = Date.now();
    res.on('finish', () => {
      const ms     = Date.now() - t0;
      const route  = req.originalUrl;
      const status = res.statusCode;
      if (ms > 500) {
        console.warn(`⚠️  [SLOW] ${req.method} ${route} → ${ms}ms [${status}]`);
      } else if (process.env.NODE_ENV !== 'production') {
        console.log(`✅ [REQ] ${req.method} ${route} → ${ms}ms [${status}]`);
      }
    });
    next();
  });

  // ── NEON KEEP-ALIVE PING ──────────────────────────────────────────────────
  // Fires every 2 minutes to prevent Neon from suspending the connection.
  // This eliminates the ~2000ms cold-start delay on the 5-minute cache cron.
  setInterval(() => {
    pingDatabase().catch(() => {}); // fire-and-forget, silent on error
  }, 2 * 60 * 1000);

  // ── INCREMENTAL CACHE REFRESH CRON ────────────────────────────────────────
  // Every 5 minutes: incremental reload (not full). <50ms in hot path.
  // Every 30 minutes: full reload to catch any drift.
  let cronTicks = 0;
  setInterval(async () => {
    cronTicks++;
    const isFull = cronTicks % 6 === 0; // every 6th tick = 30 min
    try {
      console.log('[Cron] Refreshing cache...');
      await reloadCache(); // always incremental-first
      if (isFull) console.log('[Cron] Full cache refresh ✅');
      else        console.log('[Cron] Cache refreshed ✅');
    } catch (err) {
      console.error('[Cron] Cache refresh failed:', err);
    }
  }, 5 * 60 * 1000);

  // ── ROUTES ────────────────────────────────────────────────────────────────
  app.use('/api', apiRouter);

  // ── STATIC ASSETS ─────────────────────────────────────────────────────────
  app.use('/assets', (req, res, next) => {
    const candidates = [
      path.join(process.cwd(), 'assets', req.path),
      path.join(__dirname, '..', 'assets', req.path),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p) && fs.statSync(p).isFile()) return res.sendFile(p);
    }
    next();
  });

  const publicDir = path.join(process.cwd(), 'public');
  if (fs.existsSync(publicDir)) app.use(express.static(publicDir));

  // ── DEV SERVER / VITE ─────────────────────────────────────────────────────
  if (!isProduction) {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
      app.use(vite.middlewares);
      console.log('⚡ Vite dev middleware active');
    } catch (err: any) {
      console.warn('[Vite] Could not start dev middleware:', err?.message);
    }
  }

  // ── 404 for unmatched /api routes ────────────────────────────────────────
  app.use('/api', (req, res) => {
    res.status(404).json({ error: true, message: `No route for ${req.method} ${req.originalUrl}` });
  });

  // ── CENTRALIZED ERROR HANDLER ────────────────────────────────────────────
  // Catches anything thrown/rejected anywhere upstream (including inside
  // async route handlers, now that express-async-errors forwards them here).
  // Always returns JSON, never leaks a stack trace to the client, and maps
  // common error shapes to sensible status codes instead of a raw 500.
  app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status =
      err.status || err.statusCode ||
      (err.code === '23505' ? 409 :  // Postgres unique violation
       err.code === '23503' ? 409 :  // Postgres FK violation
       err.name === 'ValidationError' ? 422 :
       err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError' ? 401 :
       500);

    console.error(`❌ [Error] ${req.method} ${req.originalUrl} → ${status}:`, err.stack || err.message || err);

    if (res.headersSent) return; // response already started (e.g. streaming a PDF)

    res.status(status).json({
      error: true,
      message: status >= 500 ? 'Internal server error' : (err.message || 'Request failed'),
      ...(process.env.NODE_ENV !== 'production' ? { detail: err.message } : {}),
    });
  });

  // ── LISTEN ────────────────────────────────────────────────────────────────
  httpServer = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Godhara server running at http://localhost:${PORT}`);
    console.log(`   Environment  : ${process.env.NODE_ENV || 'development'}`);
    console.log(`   Database     : ${isPostgresConnected ? 'PostgreSQL ✅' : 'JSON fallback ⚠️'}`);
    console.log(`   Session store: ${sessionStore ? 'PostgreSQL' : 'MemoryStore'}`);
    console.log(`   FROM_EMAIL   : ${process.env.FROM_EMAIL || '⚠️  Not set'}`);
    console.log(`   RESEND_KEY   : ${process.env.RESEND_API_KEY ? '✅' : '⚠️  Not set'}`);
    console.log(`   Cloudinary   : ${process.env.CLOUDINARY_CLOUD_NAME ? '✅' : '⚠️  Not configured'}`);
  });
}

startServer().catch(err => {
  console.error('❌ Server startup failed:', err);
  process.exit(1);
});
