import { Data } from "effect";

/**
 * Custom error class for testing errorImportPath functionality.
 * Users like Chefy want to use their own error class instead of the default tagged errors.
 */
export class MyPrismaError extends Data.TaggedError("MyPrismaError")<{
  cause: unknown;
  operation: string;
  model: string;
}> {}

/**
 * Custom error mapper function.
 * This is required when using errorImportPath - it maps raw Prisma errors to your custom type.
 *
 * You can customize the mapping logic here:
 * - Inspect error codes for specific handling
 * - Add custom metadata
 * - Throw unknown errors as defects (by re-throwing)
 */
export const mapPrismaError = (
  error: unknown,
  operation: string,
  model: string
): MyPrismaError => {
  // Example: You could inspect PrismaClientKnownRequestError.code here
  // and create different error variants or add custom fields
  return new MyPrismaError({ cause: error, operation, model });
};
