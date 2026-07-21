import express from 'express';
import cors from 'cors';
import { branding } from '@appforge/shared';
import { env } from './config/env';
import { apiRouter } from './routes';
import { errorHandler } from './middleware/error-handler';
import { rateLimit, requestId, securityHeaders } from './middleware/context';
import { closeStore, initStore } from './storage';

async function main(): Promise<void> {
  await initStore();

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // accurate client IPs behind a reverse proxy

  app.use(requestId);
  app.use(securityHeaders);
  app.use(
    cors({
      origin: env.CORS_ORIGINS.split(',').map((o) => o.trim()),
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Workspace'],
    }),
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(rateLimit);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', product: branding.productName, uptimeSeconds: Math.round(process.uptime()) });
  });

  app.use('/api/v1', apiRouter);

  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'The requested endpoint does not exist.', details: [] },
    });
  });
  app.use(errorHandler);

  const server = app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`${branding.productName} API listening on port ${env.PORT} (storage: ${env.STORAGE_DRIVER}, ai: ${env.AI_PROVIDER})`);
  });

  const shutdown = (signal: string) => {
    // eslint-disable-next-line no-console
    console.log(`Received ${signal}, shutting down gracefully...`);
    server.close(async () => {
      await closeStore();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start API:', err);
  process.exit(1);
});
