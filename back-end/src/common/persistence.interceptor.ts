import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { tap } from 'rxjs/operators';
import { DataStore } from '../store/data.store';

@Injectable()
export class PersistenceInterceptor implements NestInterceptor {
  constructor(private readonly db: DataStore) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest();
    return next.handle().pipe(tap(() => {
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) this.db.save();
    }));
  }
}
