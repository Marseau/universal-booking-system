import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import morgan from 'morgan'
import dotenv from 'dotenv'
import winston from 'winston'

// Load environment variables
dotenv.config()

// Import routes
import tenantsRouter from './routes/tenants'
import whatsappRouter from './routes/whatsapp-simple'

// Import middleware
import { resolveTenant } from './middleware/tenant-resolver'

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'universal-booking-system' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
})

// Create Express app
const app = express()
const port = process.env.PORT || 3000

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false
}))

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Slug']
}))

// Compression and logging
app.use(compression())
app.use(morgan('combined', {
  stream: {
    write: (message: string) => logger.info(message.trim())
  }
}))

// Body parser middleware
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  })
})

// API status endpoint
app.get('/api/status', (req, res) => {
  const requiredEnvVars = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'WHATSAPP_TOKEN',
    'WHATSAPP_PHONE_NUMBER_ID',
    'OPENAI_API_KEY'
  ]

  const envStatus = requiredEnvVars.reduce((acc, envVar) => {
    acc[envVar] = process.env[envVar] ? '✅ Configured' : '❌ Missing'
    return acc
  }, {} as Record<string, string>)

  const allConfigured = requiredEnvVars.every(envVar => !!process.env[envVar])

  res.json({
    service: 'Universal Booking System',
    version: '1.0.0',
    status: allConfigured ? 'ready' : 'configuration_needed',
    environment: {
      node_env: process.env.NODE_ENV || 'development',
      port: port,
      ...envStatus
    },
    features: {
      multi_tenant: '✅ Enabled',
      whatsapp_business: process.env.WHATSAPP_TOKEN ? '✅ Enabled' : '❌ Disabled',
      ai_integration: process.env.OPENAI_API_KEY ? '✅ Enabled' : '❌ Disabled',
      database: process.env.SUPABASE_URL ? '✅ Connected' : '❌ Not Connected'
    },
    domains_supported: [
      'legal',
      'healthcare', 
      'education',
      'beauty',
      'sports',
      'consulting'
    ],
    timestamp: new Date().toISOString()
  })
})

// Apply tenant resolver middleware for routes that need it
// WhatsApp webhook doesn't need tenant resolution as it identifies tenant from message
app.use('/api/tenants', resolveTenant)

// Routes
app.use('/api/tenants', tenantsRouter)
app.use('/api/whatsapp', whatsappRouter)

// Welcome endpoint
app.get('/', (req, res) => {
  res.json({
    message: '🚀 Universal Booking System API',
    description: 'Sistema Universal de Agendamentos Multi-Tenant com WhatsApp AI',
    version: '1.0.0',
    documentation: 'https://github.com/Marseau/universal-booking-system',
    endpoints: {
      health: '/health',
      status: '/api/status',
      tenants: '/api/tenants',
      whatsapp: '/api/whatsapp'
    },
    features: [
      'Multi-tenant architecture',
      'WhatsApp Business API integration',
      'AI-powered conversations',
      'Cross-tenant user support',
      'Multiple business domains'
    ],
    supported_domains: [
      'Legal (Advogados)',
      'Healthcare (Psicólogos)',
      'Education (Professores)',
      'Beauty (Salões)',
      'Sports (Personal Trainers)',
      'Consulting (Consultores)'
    ]
  })
})

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    headers: req.headers,
    body: req.body
  })

  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    timestamp: new Date().toISOString(),
    request_id: req.headers['x-request-id'] || 'unknown'
  })
})

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.originalUrl} not found`,
    available_routes: [
      'GET /',
      'GET /health',
      'GET /api/status',
      'GET /api/tenants',
      'POST /api/tenants',
      'GET /api/whatsapp/webhook',
      'POST /api/whatsapp/webhook',
      'POST /api/whatsapp/send',
      'GET /api/whatsapp/status'
    ],
    timestamp: new Date().toISOString()
  })
})

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully')
  process.exit(0)
})

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully')
  process.exit(0)
})

// Start server
const server = app.listen(port, () => {
  logger.info(`🚀 Universal Booking System started`)
  logger.info(`📊 Server running on port ${port}`)
  logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`)
  logger.info(`📱 WhatsApp Business: ${process.env.WHATSAPP_TOKEN ? 'Enabled' : 'Disabled'}`)
  logger.info(`🤖 AI Integration: ${process.env.OPENAI_API_KEY ? 'Enabled' : 'Disabled'}`)
  logger.info(`🗄️  Database: ${process.env.SUPABASE_URL ? 'Connected' : 'Not Connected'}`)
  
  if (process.env.NODE_ENV === 'development') {
    console.log('\n🔗 Quick Links:')
    console.log(`   API Status: http://localhost:${port}/api/status`)
    console.log(`   Health Check: http://localhost:${port}/health`)
    console.log(`   WhatsApp Status: http://localhost:${port}/api/whatsapp/status`)
    console.log(`   Documentation: https://github.com/Marseau/universal-booking-system`)
  }
})

// Handle server errors
server.on('error', (error: Error) => {
  logger.error('Server error:', error)
  process.exit(1)
})

export default app
