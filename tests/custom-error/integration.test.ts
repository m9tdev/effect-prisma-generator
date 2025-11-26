import { describe, expect, expectTypeOf, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import {
  LivePrismaLayer,
  PrismaService,
  MyPrismaError,
} from "./generated/effect/index.js";

// PrismaService.Default depends on PrismaClientService, so merge them
const MainLayer = Layer.merge(LivePrismaLayer, PrismaService.Default);

describe("Custom Error Generator", () => {
  describe("Error type verification", () => {
    it.effect("should use custom error type for all operations", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;

        // Create a user
        const email = `custom-error-${Date.now()}@example.com`;
        const user = yield* prisma.user.create({
          data: { email, name: "Test User" },
        });

        expect(user.email).toBe(email);

        // Cleanup
        yield* prisma.user.delete({ where: { id: user.id } });
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("findUniqueOrThrow - should return custom error type", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;

        const error = yield* prisma.user
          .findUniqueOrThrow({ where: { id: 999999 } })
          .pipe(Effect.flip);

        // Verify it's our custom error type, not the default PrismaRecordNotFoundError
        expect(error).toBeInstanceOf(MyPrismaError);
        expect(error._tag).toBe("MyPrismaError");
        expect(error.operation).toBe("findUniqueOrThrow");
        expect(error.model).toBe("User");
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("create - should return custom error for unique constraint violation", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const email = `unique-constraint-${Date.now()}@example.com`;

        // Create first user
        const user1 = yield* prisma.user.create({
          data: { email, name: "User 1" },
        });

        // Try to create second user with same email - should fail
        const error = yield* prisma.user
          .create({ data: { email, name: "User 2" } })
          .pipe(Effect.flip);

        // Verify custom error type
        expect(error).toBeInstanceOf(MyPrismaError);
        expect(error._tag).toBe("MyPrismaError");
        expect(error.operation).toBe("create");
        expect(error.model).toBe("User");

        // Cleanup
        yield* prisma.user.delete({ where: { id: user1.id } });
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("update - should return custom error when record not found", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;

        const error = yield* prisma.user
          .update({
            where: { id: 999999 },
            data: { name: "Updated" },
          })
          .pipe(Effect.flip);

        // Verify custom error type
        expect(error).toBeInstanceOf(MyPrismaError);
        expect(error._tag).toBe("MyPrismaError");
        expect(error.operation).toBe("update");
        expect(error.model).toBe("User");
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("delete - should return custom error when record not found", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;

        const error = yield* prisma.user
          .delete({ where: { id: 999999 } })
          .pipe(Effect.flip);

        // Verify custom error type
        expect(error).toBeInstanceOf(MyPrismaError);
        expect(error._tag).toBe("MyPrismaError");
        expect(error.operation).toBe("delete");
        expect(error.model).toBe("User");
      }).pipe(Effect.provide(MainLayer)),
    );
  });

  describe("Type-level tests", () => {
    it.effect("errors from all operations should be MyPrismaError", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;

        // These type assertions verify that all operations use MyPrismaError
        // They don't run at runtime but will fail TypeScript compilation if wrong

        const findEffect = prisma.user.findUnique({ where: { id: 1 } });
        expectTypeOf(findEffect).toMatchTypeOf<
          Effect.Effect<unknown, MyPrismaError>
        >();

        const createEffect = prisma.user.create({
          data: { email: "test@test.com" },
        });
        expectTypeOf(createEffect).toMatchTypeOf<
          Effect.Effect<unknown, MyPrismaError>
        >();

        const updateEffect = prisma.user.update({
          where: { id: 1 },
          data: { name: "test" },
        });
        expectTypeOf(updateEffect).toMatchTypeOf<
          Effect.Effect<unknown, MyPrismaError>
        >();

        const deleteEffect = prisma.user.delete({ where: { id: 1 } });
        expectTypeOf(deleteEffect).toMatchTypeOf<
          Effect.Effect<unknown, MyPrismaError>
        >();
      }).pipe(Effect.provide(MainLayer)),
    );
  });
});
