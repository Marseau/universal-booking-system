import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import morgan from 'morgan'
import dotenv from 'dotenv'

// Import routes
import tenantsRouter from './routes/tenants'

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

// Security middleware
app.use(helmet())
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com'] 
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}))

// Performance middleware
app.use(compression())

// Logging middleware
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))

// Body parsing middleware
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0'
  })
})

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: '🚀 Universal Booking System API',
    description: 'Sistema Universal de Agendamentos Multi-Tenant',
    version: '1.0.0',
    docs: '/docs',
    health: '/health',
    endpoints: {
      tenants: '/api/tenants',
      appointments: '/api/appointments (coming soon)',
      whatsapp: '/api/whatsapp (coming soon)',
      ai: '/api/ai (coming soon)'
    }
  })
})

// API routes
app.use('/api/tenants', tenantsRouter)

// Future routes will be added here:
// app.use('/api/appointments', appointmentsRouter) 
// app.use('/api/whatsapp', whatsappRouter)
// app.use('/api/ai', aiRouter)

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err.message)
  
  res.status(500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal Server Error' 
      : err.message,
    timestamp: new Date().toISOString()
  })
})

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  })
})

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`📚 Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`🔗 Health check: http://localhost:${PORT}/health`)
  console.log(`📖 API docs: http://localhost:${PORT}/`)
  console.log(`🏢 Tenants API: http://localhost:${PORT}/api/tenants`)
})

export default app
