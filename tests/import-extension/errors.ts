import { Data } from "effect";

export class MyPrismaError extends Data.TaggedError("MyPrismaError")<{
  cause: unknown;
  operation: string;
  model: string;
}> {}

export const mapPrismaError = (
  error: unknown,
  operation: string,
  model: string
): MyPrismaError => {
  return new MyPrismaError({ cause: error, operation, model });
};
