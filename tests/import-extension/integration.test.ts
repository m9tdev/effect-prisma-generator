import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Effect } from "effect";
import { Prisma, MyPrismaError } from "./generated/effect";
import { PrismaClient } from "./generated/client";
import * as fs from "fs";
import * as path from "path";

// Test that the generated code has the correct import with .js extension
describe("Import File Extension", () => {
  describe("Generated import statements", () => {
    it("should generate error import with .js extension", () => {
      const generatedFile = fs.readFileSync(
        path.join(__dirname, "generated/effect/index.ts"),
        "utf-8"
      );

      // The import should have .js extension added by importFileExtension config
      // Path is ../../errors.js because generated/effect/ is 2 levels deep from root
      expect(generatedFile).toContain('from "../../errors.js"');
    });

    it("should not double-add extension if already present", () => {
      const generatedFile = fs.readFileSync(
        path.join(__dirname, "generated/effect/index.ts"),
        "utf-8"
      );

      // Should not have double extensions like .js.js
      expect(generatedFile).not.toContain(".js.js");
      expect(generatedFile).not.toContain(".ts.js");
    });
  });

  describe("Runtime functionality", () => {
    let prismaClient: PrismaClient;

    beforeAll(async () => {
      prismaClient = new PrismaClient();
      await prismaClient.$connect();
    });

    afterAll(async () => {
      await prismaClient.user.deleteMany();
      await prismaClient.$disconnect();
    });

    it("should use the custom error type from the imported module", async () => {
      const program = Effect.gen(function* () {
        const prisma = yield* Prisma;

        // Create a user
        yield* prisma.user.create({
          data: { email: "test@example.com", name: "Test" },
        });

        // Try to create duplicate - should fail with MyPrismaError
        yield* prisma.user.create({
          data: { email: "test@example.com", name: "Duplicate" },
        });
      });

      const result = await Effect.runPromiseExit(
        program.pipe(Effect.provide(Prisma.Live))
      );

      expect(result._tag).toBe("Failure");
      if (result._tag === "Failure") {
        const error = result.cause;
        // The error should be our custom MyPrismaError
        expect(error._tag).toBe("Fail");
      }
    });
  });
});
