interface DatabaseErrorLike {
  code?: string;
  driverError?: {
    code?: string;
  };
}

export function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const databaseError = error as DatabaseErrorLike;
  return databaseError.code === '23505' || databaseError.driverError?.code === '23505';
}
