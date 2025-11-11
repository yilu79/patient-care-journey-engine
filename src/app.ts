import express from 'express';
import { journeyRoutes } from './routes/journeys';

const app = express();

// Middleware
app.use(express.json({ limit: '10mb' })); // Support larger payloads for journey definitions
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'RevelAI Journey Engine'
  });
});

// API Routes
app.use('/journeys', journeyRoutes);

// 404 handler for unknown routes
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Global error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(`❌ Error: ${err.message}`, err.stack);
  
  // Handle validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({ 
      error: 'Validation failed', 
      details: err.message 
    });
  }
  
  // Handle database errors
  if (err.code === 'SQLITE_CONSTRAINT') {
    return res.status(409).json({ 
      error: 'Database constraint violation', 
      details: err.message 
    });
  }
  
  // Default server error
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong!'
  });
});

export default app;