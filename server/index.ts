import 'dotenv/config'
import express from 'express'
import type { ErrorRequestHandler } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { documentsRouter } from './routes/documents.js'
import { profilesRouter } from './routes/profiles.js'
import { generateRouter } from './routes/generate.js'
import { casesRouter } from './routes/cases.js'
import { clientsRouter } from './routes/clients.js'
import { clientRouter } from './routes/client.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const PORT = process.env.PORT ?? 3001
const isDev = process.env.NODE_ENV !== 'production'

// Security headers — explicit CSP so assets load correctly for the React SPA
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"], // required for Vite HMR in dev
        styleSrc: ["'self'", "'unsafe-inline'"],  // Tailwind inline styles
        imgSrc: ["'self'", 'data:', 'blob:'],
        fontSrc: ["'self'", 'data:'],
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

// Request logging
app.use(morgan(isDev ? 'dev' : 'combined'))

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

// Health check — no sensitive info exposed to unauthenticated callers
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

// Serve the built frontend in production
if (!isDev) {
  const distPath = join(__dirname, '../dist')
  app.use(express.static(distPath))
  app.get('*', (_req, res) => {
    res.sendFile(join(distPath, 'index.html'))
  })
}

// Global error handler — catches any unhandled errors in route handlers
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  // Log full error server-side; never send stack traces to the client
  console.error('[server] Unhandled error:', err)
  const status = (err as { status?: number }).status ?? 500
  res.status(status).json({ error: 'Internal server error' })
}
app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`[server] Running on http://localhost:${PORT} (${isDev ? 'development' : 'production'})`)
})
