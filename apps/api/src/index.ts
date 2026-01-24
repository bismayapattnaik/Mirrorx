import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import { checkConnection } from './db/index.js';
import { errorHandler } from './middleware/error.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import tryOnRoutes from './routes/tryon.js';
import productRoutes from './routes/products.js';
import creditsRoutes from './routes/credits.js';
import paymentsRoutes from './routes/payments.js';
import wardrobeRoutes from './routes/wardrobe.js';
import merchantRoutes from './routes/merchant.js';
import webhookRoutes from './routes/webhooks.js';
import tailorRoutes from './routes/tailor.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Trust proxy - required for Render, Railway, and other cloud platforms
// This allows express-rate-limit to get the correct client IP
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// CORS configuration
const allowedOrigins = [
  'https://mirrorx.co.in',
  'https://www.mirrorx.co.in',
  'https://api.mirrorx.co.in',
];

// Allow any origin in development
if (process.env.NODE_ENV === 'development') {
  allowedOrigins.push(
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
  );
}

// Allow custom CORS origins via environment variable
if (process.env.CORS_ORIGIN) {
  allowedOrigins.push(...process.env.CORS_ORIGIN.split(','));
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests', message: 'Please try again later' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many auth attempts', message: 'Please try again later' },
});

const tryOnLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { error: 'Rate limited', message: 'Too many try-on requests' },
});

// Webhook routes need raw body
app.use('/webhooks', express.raw({ type: 'application/json' }), webhookRoutes);

// Parse JSON for other routes
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check - BEFORE rate limiting so Render health checks always work
app.get('/health', async (_req, res) => {
  const dbConnected = await checkConnection();
  res.json({
    status: dbConnected ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    database: dbConnected ? 'connected' : 'disconnected',
    version: process.env.npm_package_version || '1.0.0',
  });
});

// Apply rate limiting (after health check)
app.use('/auth', authLimiter);
app.use('/tryon', tryOnLimiter);
app.use(generalLimiter);

// Routes
app.use('/auth', authRoutes);
app.use('/me', userRoutes);
app.use('/user', userRoutes); // Alias for /me
app.use('/tryon', tryOnRoutes);
app.use('/products', productRoutes);
app.use('/credits', creditsRoutes);
app.use('/payments', paymentsRoutes);
app.use('/wardrobe', wardrobeRoutes);
app.use('/merchant', merchantRoutes);
app.use('/tailor', tailorRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found', message: 'The requested endpoint does not exist' });
});

// Error handler
app.use(errorHandler);

// Start server
async function start() {
  try {
    const dbConnected = await checkConnection();
    if (!dbConnected) {
      console.warn('⚠️  Database connection failed. Some features may not work.');
    } else {
      console.log('✅ Database connected');
    }

    app.listen(PORT, () => {
      console.log(`🚀 MirrorX API running on port ${PORT}`);
      console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

start();

export default app;
