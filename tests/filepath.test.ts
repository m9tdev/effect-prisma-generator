import { describe, expect, it } from "@effect/vitest";
import { Data, Effect, Layer } from "effect";
import {
  LivePrismaLayer,
  PrismaService,
  PrismaUniqueConstraintError,
} from "./generated/prisma-service.js";

describe("Prisma Effect Generator - File Path Output", () => {
  const MainLayer = Layer.merge(LivePrismaLayer, PrismaService.Default);

  it.effect("should generate service with custom filename", () =>
    Effect.gen(function* () {
      const prisma = yield* PrismaService;
      const email = `filepath-test-${Date.now()}@example.com`;

      // Create a user
      const user = yield* prisma.user.create({
        data: {
          email,
          name: "File Path Test User",
        },
      });

      expect(user.email).toBe(email);
      expect(user.name).toBe("File Path Test User");

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
});

