import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { sqlRoutes } from './routes/sql';
import { jobsRoutes } from './routes/jobs';
import { storageRoutes } from './routes/storage';
import { aiRoutes } from './routes/ai';
import { ragRoutes } from './routes/rag';
import { initSqlServer, closeSqlServer } from './services/database/sqlserver';
import { initRedshift, closeRedshift } from './services/database/redshift';
import { storageService } from './services/storage-service';
import { schedulerService } from './services/scheduler-service';
import { websocketHandlers } from './utils/websocket';

const app = new Hono();

// Middleware
app.use('*', cors({
  origin: '*',
  credentials: false,
}));
app.use('*', logger());
app.use('*', prettyJSON());

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Mount routes
app.route('/sqlserver', sqlRoutes);
app.route('/redshift', sqlRoutes); // Redshift uses same interface
app.route('/jobs', jobsRoutes);
app.route('/storage', storageRoutes);
app.route('/ai', aiRoutes);
app.route('/rag', ragRoutes);

// Startup
async function startup() {
  console.log('🚀 Starting SQL Query Studio API...');

  // Initialize database connections (non-blocking)
  try {
    await initSqlServer();
    console.log('✅ SQL Server connection initialized');
  } catch (error) {
    console.warn('⚠️ SQL Server connection failed (will retry on first request):', (error as Error).message);
  }

  try {
    await initRedshift();
    console.log('✅ Redshift connection initialized');
  } catch (error) {
    console.warn('⚠️ Redshift connection failed (will retry on first request):', (error as Error).message);
  }

  // Check S3 Storage connection
  try {
    const s3Health = await storageService.healthCheck();
    if (s3Health.connected) {
      console.log(`✅ S3 Storage connected (bucket: ${s3Health.bucket}, prefix: ${s3Health.prefix})`);
    } else {
      console.warn(`⚠️ S3 Storage disconnected (bucket: ${s3Health.bucket}) - check AWS credentials`);
    }
  } catch (error) {
    console.warn('⚠️ S3 Storage check failed:', (error as Error).message);
  }

  // Initialize scheduler
  try {
    await schedulerService.start();
    console.log('✅ Scheduler started');
  } catch (error) {
    console.warn('⚠️ Scheduler failed to start:', (error as Error).message);
  }

  console.log('✅ Server startup complete');
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  schedulerService.stop();
  await closeSqlServer();
  await closeRedshift();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down...');
  schedulerService.stop();
  await closeSqlServer();
  await closeRedshift();
  process.exit(0);
});

// Start server
startup();

const port = parseInt(process.env.PORT || '8080');
console.log(`🌐 Server running on http://localhost:${port}`);

export default {
  port,
  fetch(req: Request, server: any) {
    // Check if this is a WebSocket upgrade request for /ws/* paths
    const url = new URL(req.url);
    if (url.pathname.startsWith('/ws/') && req.headers.get('upgrade') === 'websocket') {
      // Match UUID pattern: /ws/{uuid} (32 hex chars)
      const pathMatch = url.pathname.match(/^\/ws\/([a-f0-9]{32})$/);
      if (pathMatch) {
        const success = server.upgrade(req, {
          data: {
            jobId: pathMatch[1],
            clientId: crypto.randomUUID(),
          },
        });
        if (success) {
          return undefined; // Bun handles the WebSocket
        }
      }
      return new Response('WebSocket upgrade failed', { status: 400 });
    }
    // Regular HTTP request - use Hono
    return app.fetch(req, server);
  },
  websocket: websocketHandlers,
};
