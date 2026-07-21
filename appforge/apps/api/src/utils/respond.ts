import type { Response } from 'express';
import type { ApiMeta } from '@appforge/shared';

export function ok<T>(res: Response, data: T, meta?: ApiMeta, status = 200): void {
  res.status(status).json({ success: true, data, meta: { requestId: res.locals.requestId, ...meta } });
}

export function created<T>(res: Response, data: T, meta?: ApiMeta): void {
  ok(res, data, meta, 201);
}
