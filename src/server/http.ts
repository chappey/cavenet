export class AppError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (message: string, code = 'BAD_REQUEST') => new AppError(message, 400, code);
export const unauthorized = (message: string, code = 'UNAUTHORIZED') => new AppError(message, 401, code);
export const forbidden = (message: string, code = 'FORBIDDEN') => new AppError(message, 403, code);
export const notFound = (message: string, code = 'NOT_FOUND') => new AppError(message, 404, code);
export const conflict = (message: string, code = 'CONFLICT') => new AppError(message, 409, code);
export const unprocessable = (message: string, code = 'UNPROCESSABLE_ENTITY') => new AppError(message, 422, code);
