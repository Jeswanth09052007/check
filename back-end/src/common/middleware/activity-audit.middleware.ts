import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { DataStore } from '../../store/data.store';

@Injectable()
export class ActivityAuditMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ActivityAuditMiddleware.name);
  private readonly mutatingMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

  constructor(private readonly db: DataStore) {}

  use(req: Request, res: Response, next: NextFunction) {
    const pathname = req.originalUrl.split('?')[0];
    if (!this.mutatingMethods.has(req.method) || !pathname.startsWith('/api/')) return next();

    const started = Date.now();
    const requestId = req.headers['x-request-id'];
    res.once('finish', () => {
      const route = req.route?.path;
      if (!route && ![429, 503].includes(res.statusCode)) return;
      const actor = (req as Request & { user?: { id: string; role: string; adminTeam?: string } }).user;
      const algoActions = ['orders', 'orders/process', 'orders/cancel', 'watchlist', 'account/reset'];
      const algoPath = pathname.slice('/api/algo/'.length);
      const safeRoute = pathname.startsWith('/api/algo/') && algoActions.includes(algoPath) ? pathname
        : /^\/api\/algo\/orders\/[^/]+\/cancel$/.test(pathname) ? '/api/algo/orders/:id/cancel'
          : route || '/api (blocked before the handler)';
      const target = Object.fromEntries(
        ['id', 'userId', 'learnerId', 'courseId', 'attemptId', 'orgId'].flatMap(key => {
          const value = req.params?.[key];
          return typeof value === 'string' && /^(?:[a-z]{1,12}\d{1,8}|[a-z]{1,12}_\d{13}_[a-z0-9]{5})$/i.test(value) ? [[key, value]] : [];
        }),
      );

      this.db.audit('PLATFORM_HTTP_ACTION', actor?.id || 'PUBLIC', {
        actorRole: actor?.role, adminTeam: actor?.adminTeam, requestId,
        method: req.method, route: safeRoute, ...target, statusCode: res.statusCode,
        succeeded: res.statusCode < 400, durationMs: Date.now() - started,
      });
      try {
        this.db.save();
      } catch (error) {
        this.logger.error('Failed to save the platform activity log.', error);
      }
    });
    next();
  }
}
