import app from './app';
import { getDatabase } from './db/database';

const PORT = process.env.PORT || 3000;

// Initialize database on startup
try {
  getDatabase();
  console.log('✅ Database connection established');
} catch (error) {
  console.error('❌ Failed to initialize database:', error);
  process.exit(1);
}

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('📴 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📴 SIGINT received, shutting down gracefully');
  process.exit(0);
});

const server = app.listen(PORT, () => {
  console.log('🚀 Patient Care Journey Engine started successfully!');
  console.log(`📚 API Server running on: http://localhost:${PORT}`);
  console.log(`🏥 Health check available at: http://localhost:${PORT}/health`);
  console.log(`📋 Available endpoints:`);
  console.log(`   POST /journeys - Create new journey`);
  console.log(`   POST /journeys/:id/trigger - Start journey execution`);
  console.log(`   GET /journeys/runs/:runId - Get journey run status`);
  console.log('');
  console.log('Press Ctrl+C to stop the server');
});

// Handle server startup errors
server.on('error', (error: any) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
  } else {
    console.error('❌ Server error:', error);
  }
  process.exit(1);
});

export default server;