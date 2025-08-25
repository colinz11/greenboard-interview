import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import archiveRoutes from './routes/archives';
import config from './config';

const app: Application = express();
const { port: PORT, nodeEnv: NODE_ENV } = config;

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMaxRequests,
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Security middleware - RELAXED FOR IFRAME FUNCTIONALITY
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP to allow iframe content
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration
const corsOptions = {
  origin: config.corsOrigin,
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// Compression middleware
app.use(compression());

// Logging middleware
const logFormat = NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(morgan(logFormat));

// Rate limiting (only in production)
if (NODE_ENV === 'production') {
  app.use('/api', limiter);
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint with basic monitoring
app.get('/health', (req: Request, res: Response) => {
  const healthCheck = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
    memory: process.memoryUsage(),
    diskSpace: process.cwd(), // Basic disk info
  };
  res.json(healthCheck);
});

// Ready check endpoint for container orchestration
app.get('/ready', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ready' });
});

// API info endpoint
app.get('/api', (req: Request, res: Response) => {
  res.json({ 
    message: 'Web Archiving Tool API',
    version: '1.0.0',
    environment: NODE_ENV,
    endpoints: {
      health: '/health',
      archives: '/api/archives',
    },
  });
});

// API routes
app.use('/api/archives', archiveRoutes);

// 404 handler
app.use('*', (req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
  });
});

// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Global error handler:', err);
  
  const isDevelopment = NODE_ENV === 'development';
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: isDevelopment ? err.message : 'Something went wrong',
    ...(isDevelopment && { stack: err.stack }),
  });
});

// Graceful shutdown with proper cleanup
let server: any;

const gracefulShutdown = (signal: string) => {
  console.log(`${signal} received, shutting down gracefully`);
  
  if (server) {
    server.close((err: any) => {
      if (err) {
        console.error('Error during server shutdown:', err);
        process.exit(1);
      }
      console.log('Server closed successfully');
      process.exit(0);
    });
    
    // Force shutdown after 10 seconds
    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Only start the server if this file is run directly (not during testing)
if (require.main === module) {
  server = app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT} in ${NODE_ENV} mode`);
    console.log(`📊 Health check available at http://localhost:${PORT}/health`);
    console.log(`🔄 Ready check available at http://localhost:${PORT}/ready`);
    console.log(`📡 API documentation at http://localhost:${PORT}/api`);
  });
}

export default app;