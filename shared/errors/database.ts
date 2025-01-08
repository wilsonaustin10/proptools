export type DatabaseErrorCode = 'NOT_FOUND' | 'FORBIDDEN' | 'CONFLICT' | 'DUPLICATE' | 'INTERNAL_ERROR' | 'INVALID_INPUT';

export const statusCodeMap: Record<DatabaseErrorCode, number> = {
  'NOT_FOUND': 404,
  'FORBIDDEN': 403,
  'CONFLICT': 409,
  'DUPLICATE': 409,
  'INTERNAL_ERROR': 500,
  'INVALID_INPUT': 400,
};

export class DatabaseError extends Error {
  public statusCode: number;

  constructor(
    message: string,
    public code: DatabaseErrorCode
  ) {
    super(message);
    this.name = 'DatabaseError';
    this.statusCode = statusCodeMap[code];
    
    // Fix prototype chain for proper instanceof checks
    Object.setPrototypeOf(this, DatabaseError.prototype);
  }
}
