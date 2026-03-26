import 'dotenv/config'
import express from 'express'
import type { ErrorRequestHandler } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import pino from 'pino'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { documentsRouter } from './routes/documents.js'
import { profilesRouter } from './routes/profiles.js'
import { generateRouter } from './routes/generate.js'
import { casesRouter } from './routes/cases.js'
import { clientsRouter } from './routes/clients.js'
import { clientRouter } from './routes/client.js'
import { remindersRouter } from './routes/reminders.js'
import { messagesRouter } from './routes/messages.js'
import { documentRequestsRouter } from './routes/documentRequests.js'
import { clausesRouter } from './routes/clauses.js'
import { auditLogsRouter } from './routes/auditLogs.js'
import { intakeFormsRouter } from './routes/intakeForms.js'
import { ecourtsRouter } from './routes/ecourts.js'
import { uploadsRouter } from './routes/uploads.js'
import { notificationsRouter } from './routes/notifications.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const PORT = process.env.PORT ?? 3001
const isDev = process.env.NODE_ENV !== 'production'

// ─── Structured logger ────────────────────────────────────────────────────────
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),
  transport: isDev ? { target: 'pino-pretty', options: { colorize: true } } : undefined,
})

// ─── Compression — gzip responses > 1 KB ──────────────────────────────────────
app.use(compression({ threshold: 1024 }))

// Security headers — explicit CSP so assets load correctly for the React SPA
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"], // required for Vite HMR in dev
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://*.supabase.co'],
        fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
        connectSrc: [
          "'self'",
          'https://*.supabase.co',
          'wss://*.supabase.co',
          'https://api.openai.com',
        ],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: isDev ? null : [],
      },
    },
    // HSTS: tell browsers to always use HTTPS (production only)
    strictTransportSecurity: isDev
      ? false
      : { maxAge: 31_536_000, includeSubDomains: true },
  }),
)

// Request logging via pino
app.use((req, _res, next) => {
  logger.info({ method: req.method, url: req.url }, 'request')
  next()
})

// CORS: in dev allow the Vite dev server.
// In production, Express serves the frontend on the same origin so no CORS
// headers are needed — unless FRONTEND_ORIGIN is set (e.g. CDN deployment).
const allowedOrigin = process.env.FRONTEND_ORIGIN
app.use(
  cors({
    origin: isDev
      ? ['http://localhost:5173', 'http://127.0.0.1:5173']
      : allowedOrigin
        ? allowedOrigin
        : false,
    credentials: true,
  }),
)

app.use(express.json({ limit: '10mb' }))

// Global rate limiter — broad safety net; tighter limits are applied per-route
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
})
app.use('/api', globalLimiter)

// API routes
app.use('/api/documents', documentsRouter)
app.use('/api/profiles', profilesRouter)
app.use('/api/generate', generateRouter)
app.use('/api/cases', casesRouter)
app.use('/api/clients', clientsRouter)
app.use('/api/client', clientRouter)
app.use('/api/reminders', remindersRouter)
app.use('/api/messages', messagesRouter)
app.use('/api/document-requests', documentRequestsRouter)
app.use('/api/clauses', clausesRouter)
app.use('/api/audit-logs', auditLogsRouter)
app.use('/api/intake-forms', intakeFormsRouter)
app.use('/api/ecourts', ecourtsRouter)
app.use('/api/uploads', uploadsRouter)
app.use('/api/notifications', notificationsRouter)

// Health check — no sensitive info exposed to unauthenticated callers
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

// Serve the built frontend in production with aggressive caching for hashed assets
if (!isDev) {
  const distPath = join(__dirname, '../dist')

  // Hashed asset files (*.js, *.css) — immutable, cache for 1 year
  app.use(
    '/assets',
    express.static(join(distPath, 'assets'), {
      maxAge: '1y',
      immutable: true,
      etag: false,
    }),
  )

  // Other static files (index.html, favicon) — short cache, revalidate
  app.use(express.static(distPath, { maxAge: '10m' }))

  // SPA fallback — always serve index.html for non-API, non-asset routes
  app.get('*', (_req, res) => {
    res.sendFile(join(distPath, 'index.html'))
  })
}

// Global error handler — catches any unhandled errors in route handlers
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  logger.error({ err, status: (err as { status?: number }).status }, 'Unhandled error')
  const status = (err as { status?: number }).status ?? 500
  res.status(status).json({ error: 'Internal server error' })
}
app.use(errorHandler)

// ─── Start server with graceful shutdown ──────────────────────────────────────
const server = app.listen(PORT, () => {
  logger.info({ port: PORT, env: isDev ? 'development' : 'production' }, 'Server started')
})

function shutdown(signal: string) {
  logger.info({ signal }, 'Shutdown signal received, draining connections...')
  server.close(() => {
    logger.info('Server closed gracefully')
    process.exit(0)
  })
  // Force exit after 30s if connections don't drain
  setTimeout(() => {
    logger.warn('Forcing shutdown after 30s timeout')
    process.exit(1)
  }, 30_000)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
