// ─── logging.interceptor.ts ──────────────────────────────────
import {
  Injectable, NestInterceptor, ExecutionContext,
  CallHandler, Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const { method, url, ip } = req;
    const start = Date.now();
    const traceId = `sgci-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    req.headers['x-trace-id'] = traceId;

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - start;
          const res = context.switchToHttp().getResponse();
          if (ms > 1000) {
            this.logger.warn(`[SLOW] ${method} ${url} ${res.statusCode} +${ms}ms [${traceId}]`);
          } else {
            this.logger.log(`${method} ${url} ${res.statusCode} +${ms}ms`);
          }
        },
        error: (err) => {
          const ms = Date.now() - start;
          this.logger.error(`${method} ${url} ERROR +${ms}ms — ${err.message}`);
        },
      }),
    );
  }
}

// ─── audit.interceptor.ts ─────────────────────────────────────
import {
  Injectable as I2, NestInterceptor as NI2, ExecutionContext as EC2,
  CallHandler as CH2,
} from '@nestjs/common';
import { Observable as Obs2 } from 'rxjs';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // El audit real se hace en cada service con AuditService.log()
    // Este interceptor es un placeholder para futuras métricas globales
    return next.handle();
  }
}
