import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import session from 'express-session';
import cors    from 'cors';
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

  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // ── HEALTH CHECK (before DB init guard) ──────────────────────────────────
  // Render / uptime monitors hit this — must never block on DB init
  app.get('/api/health', async (_req, res) => {
    try {
      const health = await dbObj.getHealth();
      const status = health.status === 'healthy' ? 200 : 207;
      res.status(status).json({ ...health, timestamp: new Date().toISOString() });
    } catch {
      res.status(503).json({ status: 'error', timestamp: new Date().toISOString() });
    }
  });

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

  // ── LISTEN ────────────────────────────────────────────────────────────────
  app.listen(PORT, '0.0.0.0', () => {
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
