import 'dotenv/config'
import express from 'express'
import type { ErrorRequestHandler } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
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

// Security headers
app.use(helmet())

// Request logging
app.use(morgan(isDev ? 'dev' : 'combined'))

// CORS: in dev allow the Vite dev server; in production Express serves the frontend directly
app.use(
  cors({
    origin: isDev ? ['http://localhost:5173', 'http://127.0.0.1:5173'] : false,
    credentials: true,
  }),
)

app.use(express.json({ limit: '10mb' }))

// API routes
app.use('/api/documents', documentsRouter)
app.use('/api/profiles', profilesRouter)
app.use('/api/generate', generateRouter)
app.use('/api/cases', casesRouter)
app.use('/api/clients', clientsRouter)
app.use('/api/client', clientRouter)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', env: process.env.NODE_ENV ?? 'development' })
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
  console.error('[server] Unhandled error:', err)
  const status = (err as { status?: number }).status ?? 500
  res.status(status).json({
    error: isDev ? String(err.message ?? err) : 'Internal server error',
  })
}
app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`[server] Running on http://localhost:${PORT} (${isDev ? 'development' : 'production'})`)
})
