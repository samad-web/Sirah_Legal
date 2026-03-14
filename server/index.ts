import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { documentsRouter } from './routes/documents.js'
import { profilesRouter } from './routes/profiles.js'
import { generateRouter } from './routes/generate.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const PORT = process.env.PORT ?? 3001
const isDev = process.env.NODE_ENV !== 'production'

// CORS: in dev allow the Vite dev server; in production the Express server serves the frontend directly
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

app.listen(PORT, () => {
  console.log(`[server] Running on http://localhost:${PORT} (${isDev ? 'development' : 'production'})`)
})
