import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(400, message, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(404, message);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(401, message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(403, message);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource already exists') {
    super(409, message);
    this.name = 'ConflictError';
  }
}

export class InsufficientCreditsError extends AppError {
  constructor(required: number, available: number) {
    super(402, 'Insufficient credits', { required, available });
    this.name = 'InsufficientCreditsError';
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  // Log error (but never log sensitive data)
  console.error(`[Error] ${err.name}: ${err.message}`);

  // Zod validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation error',
      message: 'Invalid request data',
      details: err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  // Custom app errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.name,
      message: err.message,
      ...(err.details && { details: err.details }),
    });
  }

  // Database errors
  if (err.message?.includes('duplicate key')) {
    return res.status(409).json({
      error: 'Conflict',
      message: 'A resource with this identifier already exists',
    });
  }

  if (err.message?.includes('foreign key')) {
    return res.status(400).json({
      error: 'Reference error',
      message: 'Referenced resource does not exist',
    });
  }

  // Default error response (don't leak internal details in production)
  const isDev = process.env.NODE_ENV === 'development';

  return res.status(500).json({
    error: 'Internal server error',
    message: isDev ? err.message : 'An unexpected error occurred',
    ...(isDev && { stack: err.stack }),
  });
}
