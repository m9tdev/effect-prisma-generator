import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { LivePrismaLayer, PrismaService } from "./generated/effect/index.js";

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
});
