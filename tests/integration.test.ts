import { describe, expect, it } from "@effect/vitest";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { Data, Effect, Layer } from "effect";
import * as fs from "fs";
import { PrismaClient } from "./prisma/generated/client";
import {
  PrismaClientService,
  PrismaService,
  PrismaTransactionClientService,
  PrismaUniqueConstraintError,
} from "./prisma/generated/effect";
import { getUsersByName } from "./prisma/generated/sql";

describe("Prisma Effect Generator", () => {
  const url = "file:prisma/dev.db";
  const adapter = new PrismaBetterSqlite3({ url });
  const prisma = new PrismaClient({ adapter });
  const MainLayer = Layer.provide(
    PrismaService.Default,
    Layer.succeed(PrismaClientService, prisma),
  );

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

  it.effect("should create and find nested posts", () =>
    Effect.gen(function* () {
      const prisma = yield* PrismaService;
      const email = `test-${Date.now()}@example.com`;
      const user = yield* prisma.user.create({
        data: {
          email,
          name: "Test User",
          posts: { create: { title: "Test Post", content: "Test Content" } },
        },
        include: { posts: true },
      });
      expect(user.posts.length).toBe(1);
      expect(user.posts[0].title).toBe("Test Post");
      expect(user.posts[0].content).toBe("Test Content");
      expect(user.posts[0].authorId).toBe(user.id);
    }).pipe(Effect.provide(MainLayer)),
  );

  it.effect("should support groupBy", () =>
    Effect.gen(function* () {
      const prisma = yield* PrismaService;
      const user = yield* prisma.user.create({
        data: {
          email: `test-${Date.now()}@example.com`,
          name: "Test User",
          posts: {
            createMany: {
              data: [
                { title: "Test Post 1", content: "Test Content 1" },
                { title: "Test Post 2", content: "Test Content 2" },
              ],
            },
          },
        },
      });
      const result = yield* prisma.post.groupBy({
        by: ["authorId"],
        where: {
          authorId: user.id,
        },
        _count: true,
      });
      expect(result.length).toBe(1);
      expect(result[0]._count).toBe(2);
      expect(result[0].authorId).toBe(user.id);
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

  it.effect(
    "should have a PrismaTransactionClientService in transactions",
    () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;

        yield* prisma.$transaction(
          Effect.gen(function* () {
            // Should have a transaction client service inside the transaction
            const tx = yield* Effect.serviceOption(
              PrismaTransactionClientService,
            );
            expect(tx._tag).toBe("Some");
          }),
        );

        // No transaction client service outside of transaction
        const tx = yield* Effect.serviceOption(PrismaTransactionClientService);
        expect(tx._tag).toBe("None");
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

  it.effect("should support $queryRawTyped with TypedSQL", () =>
    Effect.gen(function* () {
      const prisma = yield* PrismaService;
      const email = `typed-sql-test-${Date.now()}@example.com`;

      // Create test user
      const user = yield* prisma.user.create({
        data: { email, name: "TypedSQL Test User" },
      });

      // Use TypedSQL query
      const users = yield* prisma.$queryRawTyped(
        getUsersByName("%TypedSQL%"),
      );

      // Verify result
      expect(users.length).toBeGreaterThan(0);
      expect(users[0].email).toBeDefined();
      expect(users[0].name).toContain("TypedSQL");

      // Cleanup
      yield* prisma.user.delete({ where: { id: user.id } });
    }).pipe(Effect.provide(MainLayer)),
  );

  it.effect("should support $queryRawTyped within transactions", () =>
    Effect.gen(function* () {
      const prisma = yield* PrismaService;
      const email = `tx-typed-sql-${Date.now()}@example.com`;

      yield* prisma.$transaction(
        Effect.gen(function* () {
          yield* prisma.user.create({
            data: { email, name: "Transaction TypedSQL User" },
          });

          const users = yield* prisma.$queryRawTyped(
            getUsersByName("%Transaction TypedSQL%"),
          );
          expect(users.length).toBe(1);
          expect(users[0].name).toBe("Transaction TypedSQL User");
        }),
      );

      // Cleanup
      yield* prisma.user.delete({ where: { email } });
    }).pipe(Effect.provide(MainLayer)),
  );

  it("should include $queryRawTyped when typedSql preview feature is enabled", () => {
    const generated = fs.readFileSync("prisma/generated/effect.ts", "utf-8");
    expect(generated).toContain("$queryRawTyped");
    expect(generated).toContain('import * as runtime from "@prisma/client/runtime/client"');
  });

  it("should not include $queryRawTyped when typedSql preview feature is not enabled", () => {
    const generated = fs.readFileSync("no-typedsql/generated/effect.ts", "utf-8");
    expect(generated).not.toContain("$queryRawTyped");
    expect(generated).not.toContain('import * as runtime from "@prisma/client/runtime/client"');
  });
});
