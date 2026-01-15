/**
 * Standardized API Error System
 *
 * Provides consistent error handling across all API endpoints.
 * All errors follow a standard schema for predictable client-side handling.
 */

/**
 * Error codes for programmatic error handling
 */
export const ErrorCode = {
  // Client errors (4xx)
  BAD_REQUEST: 'BAD_REQUEST',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',

  // Server errors (5xx)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR: 'DATABASE_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Standard API error response shape
 */
export interface ApiErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * HTTP status codes mapped to error codes
 */
const errorCodeToStatus: Record<ErrorCode, number> = {
  [ErrorCode.BAD_REQUEST]: 400,
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
  [ErrorCode.DATABASE_ERROR]: 500,
};

/**
 * Custom API Error class
 *
 * Throw this in route handlers for consistent error responses.
 *
 * @example
 * throw new ApiError(ErrorCode.NOT_FOUND, 'Series not found', { seriesId });
 */
export class ApiError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = errorCodeToStatus[code];
    this.details = details;
  }

  /**
   * Convert to API response format
   */
  toResponse(): ApiErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details }),
      },
    };
  }
}

/**
 * Convenience error factories for common cases
 */
export const Errors = {
  badRequest: (message: string, details?: Record<string, unknown>) =>
    new ApiError(ErrorCode.BAD_REQUEST, message, details),

  validation: (message: string, details?: Record<string, unknown>) =>
    new ApiError(ErrorCode.VALIDATION_ERROR, message, details),

  unauthorized: (message = 'Authentication required') =>
    new ApiError(ErrorCode.UNAUTHORIZED, message),

  forbidden: (message = 'Access denied') =>
    new ApiError(ErrorCode.FORBIDDEN, message),

  notFound: (resource: string, id?: string) =>
    new ApiError(
      ErrorCode.NOT_FOUND,
      id ? `${resource} not found: ${id}` : `${resource} not found`,
      id ? { resourceId: id } : undefined
    ),

  conflict: (message: string, details?: Record<string, unknown>) =>
    new ApiError(ErrorCode.CONFLICT, message, details),

  rateLimited: (message = 'Too many requests') =>
    new ApiError(ErrorCode.RATE_LIMITED, message),

  internal: (message = 'Internal server error') =>
    new ApiError(ErrorCode.INTERNAL_ERROR, message),

  database: (message = 'Database error') =>
    new ApiError(ErrorCode.DATABASE_ERROR, message),
};

/**
 * Type guard to check if error is an ApiError
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Wrap unknown errors into ApiError
 * Preserves ApiError instances, converts others to internal errors
 */
export function toApiError(error: unknown): ApiError {
  if (isApiError(error)) {
    return error;
  }

  // Log the original error for debugging
  console.error('Unexpected error:', error);

  // Don't expose internal error details to clients
  return Errors.internal('An unexpected error occurred');
}
