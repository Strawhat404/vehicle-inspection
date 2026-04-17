import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import { rateLimit } from './middleware/rateLimit.js';
import { authOptional } from './middleware/auth.js';
import { safeLog } from './utils/redaction.js';
import healthRoutes from './routes/health.js';
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import securityRoutes from './routes/security.js';
import coordinatorRoutes from './routes/coordinator.js';
import ingestionRoutes from './routes/ingestion.js';
import searchRoutes from './routes/search.js';
import messagesRoutes from './routes/messages.js';
import filesRoutes from './routes/files.js';
import complianceRoutes from './routes/compliance.js';
import usersRoutes from './routes/users.js';
import rolesRoutes from './routes/roles.js';
import auditRoutes from './routes/audit.js';
import inspectionsRoutes from './routes/inspections.js';
import { config } from './config.js';

export function createApp() {
  const app = new Koa();

  app.use(async (ctx, next) => {
    const allowedOrigin = config.frontend.origin;
    const requestOrigin = ctx.get('Origin');

    if (requestOrigin === allowedOrigin) {
      ctx.set('Access-Control-Allow-Origin', allowedOrigin);
      ctx.set('Vary', 'Origin');
    }

    ctx.set('Access-Control-Allow-Credentials', 'true');
    ctx.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    ctx.set('Access-Control-Allow-Headers', 'Content-Type,Authorization,Accept');

    if (ctx.method === 'OPTIONS') {
      ctx.status = 204;
      return;
    }

    await next();
  });

  app.use(async (ctx, next) => {
    try {
      await next();
    } catch (error) {
      safeLog('request_error', {
        method: ctx.method,
        url: ctx.url,
        error: error.message,
        stack: error.stack
      });
      ctx.status = error.status || 500;
      ctx.body = { error: 'Internal Server Error' };
    }
  });
  app.use(bodyParser({ enableTypes: ['json'] }));
  app.use(authOptional);

  app.use(async (ctx, next) => {
    const unsafeMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(ctx.method);
    if (!unsafeMethod) {
      await next();
      return;
    }

    if (ctx.path === '/api/auth/login') {
      await next();
      return;
    }

    const authHeader = ctx.headers.authorization || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!bearerToken) {
      await next();
      return;
    }

    const csrfToken = String(ctx.headers['x-csrf-token'] || '');
    if (!csrfToken || csrfToken !== bearerToken) {
      ctx.status = 403;
      ctx.body = { error: 'CSRF token validation failed' };
      return;
    }

    await next();
  });

  app.use(rateLimit);

  app.use(healthRoutes.routes()).use(healthRoutes.allowedMethods());
  app.use(authRoutes.routes()).use(authRoutes.allowedMethods());
  app.use(dashboardRoutes.routes()).use(dashboardRoutes.allowedMethods());
  app.use(securityRoutes.routes()).use(securityRoutes.allowedMethods());
  app.use(coordinatorRoutes.routes()).use(coordinatorRoutes.allowedMethods());
  app.use(ingestionRoutes.routes()).use(ingestionRoutes.allowedMethods());
  app.use(searchRoutes.routes()).use(searchRoutes.allowedMethods());
  app.use(messagesRoutes.routes()).use(messagesRoutes.allowedMethods());
  app.use(filesRoutes.routes()).use(filesRoutes.allowedMethods());
  app.use(complianceRoutes.routes()).use(complianceRoutes.allowedMethods());
  app.use(usersRoutes.routes()).use(usersRoutes.allowedMethods());
  app.use(rolesRoutes.routes()).use(rolesRoutes.allowedMethods());
  app.use(auditRoutes.routes()).use(auditRoutes.allowedMethods());
  app.use(inspectionsRoutes.routes()).use(inspectionsRoutes.allowedMethods());

  return app;
}
