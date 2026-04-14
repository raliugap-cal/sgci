// ═══════════════════════════════════════════════════════════
// COMMON — Filtros · Interceptores · Middleware
// ═══════════════════════════════════════════════════════════

// ─── prisma-exception.filter.ts ─────────────────────────────
import {
  ExceptionFilter, Catch, ArgumentsHost, HttpException,
  HttpStatus, Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

@Catch()
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Error interno del servidor';
    let error = 'Internal Server Error';

    // Errores de Prisma
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002': // Unique constraint
          status = HttpStatus.CONFLICT;
          const field = (exception.meta?.target as string[])?.join(', ') ?? 'campo';
          message = `Ya existe un registro con ese ${field}`;
          error = 'Conflict';
          break;
        case 'P2025': // Record not found
          status = HttpStatus.NOT_FOUND;
          message = 'Registro no encontrado';
          error = 'Not Found';
          break;
        case 'P2003': // Foreign key constraint
          status = HttpStatus.BAD_REQUEST;
          message = 'Referencia inválida — el registro relacionado no existe';
          error = 'Bad Request';
          break;
        case 'P2014': // Relation violation
          status = HttpStatus.BAD_REQUEST;
          message = 'Violación de relación de datos';
          error = 'Bad Request';
          break;
        default:
          this.logger.error(`Prisma error ${exception.code}: ${exception.message}`);
          message = 'Error de base de datos';
      }
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Datos inválidos para la operación';
      error = 'Validation Error';
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resp = exception.getResponse();
      message = typeof resp === 'object' ? (resp as any).message ?? exception.message : exception.message;
      error = exception.name;
    } else if (exception instanceof Error) {
      this.logger.error(`Unhandled exception: ${exception.message}`, exception.stack);
    }

    const traceId = request.headers['x-trace-id'] ?? `sgci-${Date.now()}`;

    response.status(status).json({
      statusCode: status,
      error,
      message: Array.isArray(message) ? message[0] : message,
      messages: Array.isArray(message) ? message : [message],
      traceId,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
