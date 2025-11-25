import { describe, expect, expectTypeOf, it } from "@effect/vitest";
import { Data, Effect, Layer } from "effect";
import {
  LivePrismaLayer,
  PrismaService,
  PrismaUniqueConstraintError,
} from "./generated/effect/index.js";

describe("Prisma Effect Generator", () => {
  const MainLayer = Layer.merge(LivePrismaLayer, PrismaService.Default);

  it.effect("should create and find a user", () =>
    Effect.gen(function* () {
      const prisma = yield* PrismaService;
      const email = `test-${Date.now()}@example.com`;

      // Create a user
      const user = yield* prisma.user.create({
        data: {
          email,
          name: "Test User",
        },
      });

      expect(user.email).toBe(email);
      expect(user.name).toBe("Test User");

      // Find the user
      const found = yield* prisma.user.findUnique({
        where: { id: user.id },
      });

      expect(found).not.toBeNull();
      expect(found?.email).toBe(email);

      // Cleanup
      yield* prisma.user.delete({
        where: { id: user.id },
      });
    }).pipe(Effect.provide(MainLayer)),
  );

  it.effect("should support transactions", () =>
    Effect.gen(function* () {
      const prisma = yield* PrismaService;
      const email = `tx-test-${Date.now()}@example.com`;

      // Transaction that should succeed
      yield* prisma.$transaction(
        Effect.gen(function* () {
          yield* prisma.user.create({
            data: {
              email,
              name: "Tx User",
            },
          });
        }),
      );

      // Verify outside transaction
      const found = yield* prisma.user.findUnique({
        where: { email },
      });
      expect(found).not.toBeNull();
      expect(found?.name).toBe("Tx User");

      // Cleanup
      yield* prisma.user.delete({
        where: { email },
      });
    }).pipe(Effect.provide(MainLayer)),
  );

  it.effect("should rollback transaction on error", () =>
    Effect.gen(function* () {
      const prisma = yield* PrismaService;
      const email = `rollback-test-${Date.now()}@example.com`;
      const nestedEmail = `nested-rollback-test-${Date.now()}@example.com`;

      const program = prisma.$transaction(
        Effect.gen(function* () {
          yield* prisma.user.create({
            data: {
              email,
              name: "Rollback User",
            },
          });

          yield* prisma.$transaction(
            Effect.gen(function* () {
              yield* prisma.user.create({
                data: { email: nestedEmail, name: "Nested User" },
              });
            }),
          );

          // Force error
          yield* Effect.fail("Boom");
        }),
      );

      // We expect failure
      yield* Effect.flip(program);

      // Verify rollback
      const found = yield* prisma.user.findMany({
        where: { email: { in: [email, nestedEmail] } },
      });
      expect(found.length).toBe(0);
    }).pipe(Effect.provide(MainLayer)),
  );

  it.effect("should return PrismaUniqueConstraintError on duplicate key", () =>
    Effect.gen(function* () {
      const prisma = yield* PrismaService;
      const email = `duplicate-test-${Date.now()}@example.com`;

      // Create first user
      yield* prisma.user.create({
        data: { email, name: "User 1" },
      });

      // Try to create second user with same email
      const result = yield* Effect.flip(
        prisma.user.create({
          data: { email, name: "User 2" },
        }),
      );

      // Verify error type
      expect(result).toBeInstanceOf(PrismaUniqueConstraintError);
      if (result instanceof PrismaUniqueConstraintError) {
        expect(result.cause.code).toBe("P2002");
      }

      // Cleanup
      yield* prisma.user.delete({
        where: { email },
      });
    }).pipe(Effect.provide(MainLayer)),
  );

  it.effect("should preserve custom error types in transaction", () =>
    Effect.gen(function* () {
      class MyCustomError extends Data.TaggedError("MyCustomError")<{
        message: string;
      }> {}

      const prisma = yield* PrismaService;

      const program = prisma.$transaction(
        Effect.fail(new MyCustomError({ message: "boom" })),
      );

      const error = yield* Effect.flip(program);

      expect(error).toBeInstanceOf(MyCustomError);
      if (error instanceof MyCustomError) {
        expect(error.message).toBe("boom");
      }
    }).pipe(Effect.provide(MainLayer)),
  );

  it.effect("should narrow types with select clause", () =>
    Effect.gen(function* () {
      const prisma = yield* PrismaService;
      const email = `type-test-${Date.now()}@example.com`;

      // Create a user
      const user = yield* prisma.user.create({
        data: { email, name: "Type Test User" },
      });

      // Test type narrowing with select
      const narrowed = yield* prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true },
      });

      // Type-level assertion: narrowed should only have 'id' property
      expectTypeOf(narrowed).toEqualTypeOf<{ id: number } | null>();

      // Runtime assertion
      expect(narrowed).not.toBeNull();
      expect(narrowed?.id).toBe(user.id);
      // @ts-expect-error - 'email' should not exist on narrowed type
      expect(narrowed?.email).toBeUndefined();

      // Test with multiple selected fields
      const multiSelect = yield* prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, email: true },
      });

      expectTypeOf(multiSelect).toEqualTypeOf<{ id: number; email: string } | null>();

      // Cleanup
      yield* prisma.user.delete({ where: { id: user.id } });
    }).pipe(Effect.provide(MainLayer)),
  );

  it.effect("should narrow types with findMany select", () =>
    Effect.gen(function* () {
      const prisma = yield* PrismaService;

      // Test type narrowing with findMany
      const users = yield* prisma.user.findMany({
        select: { email: true },
      });

      // Type-level assertion: should be array of { email: string }
      expectTypeOf(users).toEqualTypeOf<{ email: string }[]>();
    }).pipe(Effect.provide(MainLayer)),
  );

  it.effect("should return full model when no select", () =>
    Effect.gen(function* () {
      const prisma = yield* PrismaService;
      const email = `full-model-${Date.now()}@example.com`;

      const user = yield* prisma.user.create({
        data: { email, name: "Full Model User" },
      });

      const found = yield* prisma.user.findUnique({
        where: { id: user.id },
      });

      // Type-level assertion: should have all User fields
      expectTypeOf(found).toEqualTypeOf<{
        id: number;
        email: string;
        name: string | null;
      } | null>();

      // Cleanup
      yield* prisma.user.delete({ where: { id: user.id } });
    }).pipe(Effect.provide(MainLayer)),
  );
});
