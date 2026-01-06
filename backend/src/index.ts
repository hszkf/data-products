import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { prettyJSON } from 'hono/pretty-json';
import { sqlRoutes } from './routes/sql';
import { sqlv2Routes } from './routes/sqlv2';
import { jobsRoutes } from './routes/jobs';
import { storageRoutes } from './routes/storage';
import { aiRoutes } from './routes/ai';
import { ragRoutes } from './routes/rag';
import { authRoutes } from './routes/auth';
import { usersRoutes } from './routes/users';
import { logsRoutes } from './routes/logs';
import { initSqlServer, closeSqlServer, getHealthStatus as getSqlServerHealth } from './services/database/sqlserver';
import { initRedshift, closeRedshift, getHealthStatus as getRedshiftHealth } from './services/database/redshift';
import { initUnifiedSql, closeUnifiedSql, getUnifiedHealthStatus } from './services/database/unified-sql';
import { storageService } from './services/storage-service';
import { schedulerService } from './services/scheduler-service';
import { websocketHandlers } from './utils/websocket';
import { requestIdMiddleware, requestLoggerMiddleware, errorHandler, notFoundHandler } from './middleware/error-handler';
import { logger } from './utils/logger';

const app = new Hono();

// Use Hono's built-in onError handler for proper error catching
app.onError((err, c) => {
  const requestId = c.get('requestId') || 'unknown';
  const user = c.get('user');

  // Check if it's an AppError
  if ((err as any).statusCode && (err as any).code) {
    const appError = err as any;
    
    // Log based on whether it's operational
    if (appError.isOperational) {
      logger.warn(`${appError.code}: ${appError.message}`, {
        requestId,
        userId: user?.id,
        username: user?.username,
        method: c.req.method,
        path: c.req.path,
        metadata: { statusCode: appError.statusCode },
      });
    } else {
      logger.error('Request error', err, {
        requestId,
        userId: user?.id,
        username: user?.username,
        method: c.req.method,
        path: c.req.path,
      });
    }

    return c.json(
      {
        status: 'error',
        code: appError.code,
        message: appError.message,
        ...(appError.details && { details: appError.details }),
        requestId,
      },
      appError.statusCode
    );
  }

  // Unknown error
  logger.error('Unexpected error', err, {
    requestId,
    userId: user?.id,
    username: user?.username,
    method: c.req.method,
    path: c.req.path,
  });

  return c.json(
    {
      status: 'error',
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      requestId,
    },
    500
  );
});

// Global middleware (order matters!)
// 1. Request ID first so all logs have it
app.use('*', requestIdMiddleware);
// 2. CORS for cross-origin requests
app.use('*', cors({
  origin: '*',
  credentials: true,
}));
// 3. Pretty JSON for readable responses
app.use('*', prettyJSON());
// 4. Request logger
app.use('*', requestLoggerMiddleware);

// Health check (no auth required)
app.get('/health', (c) => {
  return c.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Auth routes (no auth required for login)
app.route('/auth', authRoutes);

// Health endpoints for each service (no auth required)
app.get('/sqlserver/health', async (c) => {
  try {
    const health = await getSqlServerHealth();
    return c.json(health, health.connected ? 200 : 503);
  } catch (error) {
    return c.json({ status: 'disconnected', connected: false, error: (error as Error).message }, 503);
  }
});

app.get('/redshift/health', async (c) => {
  try {
    const health = await getRedshiftHealth();
    return c.json(health, health.connected ? 200 : 503);
  } catch (error) {
    return c.json({ status: 'disconnected', connected: false, error: (error as Error).message }, 503);
  }
});

app.get('/storage/health', async (c) => {
  try {
    const health = await storageService.healthCheck();
    return c.json({ status: health.connected ? 'connected' : 'disconnected', ...health }, health.connected ? 200 : 503);
  } catch (error) {
    return c.json({ status: 'disconnected', connected: false, error: (error as Error).message }, 503);
  }
});

app.get('/sqlv2/health', async (c) => {
  try {
    const health = await getUnifiedHealthStatus();
    const allConnected = health.redshift.connected && health.sqlserver.connected;
    return c.json({ status: allConnected ? 'connected' : 'partial', ...health }, allConnected ? 200 : 503);
  } catch (error) {
    return c.json({ status: 'disconnected', error: (error as Error).message }, 503);
  }
});

// Routes are now public (no auth required)

// Mount routes
app.route('/sqlserver', sqlRoutes);
app.route('/redshift', sqlRoutes); // Redshift uses same interface
app.route('/sqlv2', sqlv2Routes); // Unified SQL v2 routes
app.route('/jobs', jobsRoutes);
app.route('/storage', storageRoutes);
app.route('/ai', aiRoutes);
app.route('/rag', ragRoutes);
app.route('/users', usersRoutes);
app.route('/logs', logsRoutes);

// 404 handler
app.notFound(notFoundHandler);

// Startup
async function startup() {
  logger.info('Starting Data Products API...');

  // Initialize database connections (non-blocking)
  try {
    await initSqlServer();
    logger.info('SQL Server connection initialized');
  } catch (error) {
    logger.warn('SQL Server connection failed (will retry on first request)', { 
      metadata: { error: (error as Error).message }
    });
  }

  try {
    await initRedshift();
    logger.info('Redshift connection initialized');
  } catch (error) {
    logger.warn('Redshift connection failed (will retry on first request)', {
      metadata: { error: (error as Error).message }
    });
  }

  // Initialize Unified SQL (v2) connections
  try {
    await initUnifiedSql();
    logger.info('Unified SQL (v2) connections initialized');
  } catch (error) {
    logger.warn('Unified SQL initialization failed', {
      metadata: { error: (error as Error).message }
    });
  }

  // Check S3 Storage connection
  try {
    const s3Health = await storageService.healthCheck();
    if (s3Health.connected) {
      logger.info('S3 Storage connected', { 
        metadata: { bucket: s3Health.bucket, prefix: s3Health.prefix }
      });
    } else {
      logger.warn('S3 Storage disconnected - check AWS credentials', {
        metadata: { bucket: s3Health.bucket }
      });
    }
  } catch (error) {
    logger.warn('S3 Storage check failed', {
      metadata: { error: (error as Error).message }
    });
  }

  // Initialize scheduler
  try {
    await schedulerService.start();
    logger.info('Scheduler started');
  } catch (error) {
    logger.warn('Scheduler failed to start', {
      metadata: { error: (error as Error).message }
    });
  }

  logger.info('Server startup complete');
  console.log('🚀 Data Products API started successfully');
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down...');
  console.log('\n🛑 Shutting down...');
  schedulerService.stop();
  await closeSqlServer();
  await closeRedshift();
  await closeUnifiedSql();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down...');
  console.log('\n🛑 Shutting down...');
  schedulerService.stop();
  await closeSqlServer();
  await closeRedshift();
  await closeUnifiedSql();
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
  console.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', reason as Error);
  console.error('Unhandled rejection:', reason);
});

// Start server - wait for initialization to complete
const port = parseInt(process.env.PORT || '8080');
await startup();
console.log(`🌐 Server running on http://localhost:${port}`);

export default {
  port,
  idleTimeout: 120, // 2 minutes timeout for long-running queries (default is 10s)
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
