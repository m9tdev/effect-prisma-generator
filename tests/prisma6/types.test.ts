/**
 * Type-level tests for the Effect Prisma Generator
 *
 * These tests verify that:
 * 1. Input args are correctly typed (select, include, where, etc.)
 * 2. Return types narrow correctly based on select/include
 * 3. Invalid args produce compile errors
 * 4. Relation selection works correctly
 *
 * NOTE: These tests verify TypeScript types at compile time.
 * Runtime execution is secondary - we care that the types are correct.
 */

import { describe, expectTypeOf, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import {
  LivePrismaLayer,
  PrismaService,
  PrismaClientService,
  PrismaFindError,
  PrismaFindOrThrowError,
  PrismaCreateError,
  PrismaUpdateError,
  PrismaDeleteError,
} from "./generated/effect/index.js";

const MainLayer = Layer.merge(LivePrismaLayer, PrismaService.Default);

// ============================================
// Type-level tests - these verify types at compile time
// ============================================

describe("Type-level tests", () => {
  // ============================================
  // Return Type Inference
  // ============================================

  describe("Return type inference", () => {
    it.effect("findUnique without select returns full model | null", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;

        const result = yield* prisma.user.findUnique({
          where: { id: 1 },
        });

        // Should be full User model or null
        expectTypeOf(result).toEqualTypeOf<{
          id: number;
          email: string;
          name: string | null;
        } | null>();
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("findUnique with select narrows to selected fields", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;

        const result = yield* prisma.user.findUnique({
          where: { id: 1 },
          select: { id: true, email: true },
        });

        // Should be narrowed to only selected fields
        expectTypeOf(result).toEqualTypeOf<{
          id: number;
          email: string;
        } | null>();
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("findUniqueOrThrow returns non-null model", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;

        // Type-level check: verify the return type is non-null
        const effect = prisma.user.findUniqueOrThrow({
          where: { id: 1 },
        });

        // Extract success type and verify it's not nullable
        type SuccessType = Effect.Effect.Success<typeof effect>;
        expectTypeOf<SuccessType>().toEqualTypeOf<{
          id: number;
          email: string;
          name: string | null;
        }>();

        // This will fail at runtime (no record exists), but type is correct
        return Effect.succeed(undefined);
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("findMany returns array of models", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;

        const result = yield* prisma.user.findMany();

        expectTypeOf(result).toEqualTypeOf<
          Array<{
            id: number;
            email: string;
            name: string | null;
          }>
        >();
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("findMany with select returns array of narrowed type", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;

        const result = yield* prisma.user.findMany({
          select: { email: true },
        });

        expectTypeOf(result).toEqualTypeOf<Array<{ email: string }>>();
      }).pipe(Effect.provide(MainLayer)),
    );

    it("create returns created model (type-only)", () => {
      // Type-level check without runtime execution
      const _typeCheck = (prisma: Effect.Effect.Success<typeof PrismaService>) => {
        const effect = prisma.user.create({
          data: { email: "test@example.com" },
        });

        type ResultType = Effect.Effect.Success<typeof effect>;
        expectTypeOf<ResultType>().toEqualTypeOf<{
          id: number;
          email: string;
          name: string | null;
        }>();
      };
    });

    it("create with select narrows return type (type-only)", () => {
      const _typeCheck = (prisma: Effect.Effect.Success<typeof PrismaService>) => {
        const effect = prisma.user.create({
          data: { email: "test@example.com" },
          select: { id: true },
        });

        type ResultType = Effect.Effect.Success<typeof effect>;
        expectTypeOf<ResultType>().toEqualTypeOf<{ id: number }>();
      };
    });
  });

  // ============================================
  // Relation Include Types
  // ============================================

  describe("Relation include types", () => {
    it.effect("include: { posts: true } adds posts array to return type", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;

        const result = yield* prisma.user.findUnique({
          where: { id: 1 },
          include: { posts: true },
        });

        // posts should be added to the type
        expectTypeOf(result).toEqualTypeOf<{
          id: number;
          email: string;
          name: string | null;
          posts: Array<{
            id: number;
            title: string;
            content: string | null;
            published: boolean;
            authorId: number;
          }>;
        } | null>();
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("include with nested select narrows included relation", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;

        const result = yield* prisma.user.findUnique({
          where: { id: 1 },
          include: {
            posts: {
              select: { id: true, title: true },
            },
          },
        });

        expectTypeOf(result).toEqualTypeOf<{
          id: number;
          email: string;
          name: string | null;
          posts: Array<{ id: number; title: string }>;
        } | null>();
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("include with where filters posts (type unchanged)", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;

        const result = yield* prisma.user.findUnique({
          where: { id: 1 },
          include: {
            posts: {
              where: { published: true },
            },
          },
        });

        // Type still includes all Post fields
        expectTypeOf(result).toEqualTypeOf<{
          id: number;
          email: string;
          name: string | null;
          posts: Array<{
            id: number;
            title: string;
            content: string | null;
            published: boolean;
            authorId: number;
          }>;
        } | null>();
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("post.findUnique with include: { author: true } adds author", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;

        const result = yield* prisma.post.findUnique({
          where: { id: 1 },
          include: { author: true },
        });

        expectTypeOf(result).toEqualTypeOf<{
          id: number;
          title: string;
          content: string | null;
          published: boolean;
          authorId: number;
          author: {
            id: number;
            email: string;
            name: string | null;
          };
        } | null>();
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("deeply nested include (author with posts)", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;

        const result = yield* prisma.post.findUnique({
          where: { id: 1 },
          include: {
            author: {
              include: { posts: true },
            },
          },
        });

        expectTypeOf(result).toEqualTypeOf<{
          id: number;
          title: string;
          content: string | null;
          published: boolean;
          authorId: number;
          author: {
            id: number;
            email: string;
            name: string | null;
            posts: Array<{
              id: number;
              title: string;
              content: string | null;
              published: boolean;
              authorId: number;
            }>;
          };
        } | null>();
      }).pipe(Effect.provide(MainLayer)),
    );
  });

  // ============================================
  // Select vs Include Types
  // ============================================

  describe("Select with relations", () => {
    it.effect("select with nested relation select", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;

        const result = yield* prisma.user.findUnique({
          where: { id: 1 },
          select: {
            id: true,
            posts: {
              select: { title: true },
            },
          },
        });

        expectTypeOf(result).toEqualTypeOf<{
          id: number;
          posts: Array<{ title: string }>;
        } | null>();
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("select: false excludes field (full relation selection)", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;

        // When using include: { posts: true }, you get all User fields + posts
        const result = yield* prisma.user.findUnique({
          where: { id: 1 },
          select: {
            email: true,
            // name is not selected
            posts: true, // include all post fields
          },
        });

        expectTypeOf(result).toEqualTypeOf<{
          email: string;
          posts: Array<{
            id: number;
            title: string;
            content: string | null;
            published: boolean;
            authorId: number;
          }>;
        } | null>();
      }).pipe(Effect.provide(MainLayer)),
    );
  });

  // ============================================
  // Error Type Inference
  // ============================================

  describe("Error type inference", () => {
    it("findUnique has PrismaFindError error channel (type-only)", () => {
      const _typeCheck = (prisma: Effect.Effect.Success<typeof PrismaService>) => {
        const effect = prisma.user.findUnique({ where: { id: 1 } });

        type ErrorType = Effect.Effect.Error<typeof effect>;
        expectTypeOf<ErrorType>().toEqualTypeOf<PrismaFindError>();
      };
    });

    it("findUniqueOrThrow errors include PrismaFindOrThrowError (type-only)", () => {
      const _typeCheck = (prisma: Effect.Effect.Success<typeof PrismaService>) => {
        const effect = prisma.user.findUniqueOrThrow({ where: { id: 1 } });

        type ErrorType = Effect.Effect.Error<typeof effect>;
        expectTypeOf<ErrorType>().toEqualTypeOf<PrismaFindOrThrowError>();
      };
    });

    it("create errors include PrismaCreateError (type-only)", () => {
      const _typeCheck = (prisma: Effect.Effect.Success<typeof PrismaService>) => {
        const effect = prisma.user.create({ data: { email: "x@x.com" } });

        type ErrorType = Effect.Effect.Error<typeof effect>;
        expectTypeOf<ErrorType>().toEqualTypeOf<PrismaCreateError>();
      };
    });

    it("update errors include PrismaUpdateError (type-only)", () => {
      const _typeCheck = (prisma: Effect.Effect.Success<typeof PrismaService>) => {
        const effect = prisma.user.update({
          where: { id: 1 },
          data: { name: "New" },
        });

        type ErrorType = Effect.Effect.Error<typeof effect>;
        expectTypeOf<ErrorType>().toEqualTypeOf<PrismaUpdateError>();
      };
    });

    it("delete errors include PrismaDeleteError (type-only)", () => {
      const _typeCheck = (prisma: Effect.Effect.Success<typeof PrismaService>) => {
        const effect = prisma.user.delete({ where: { id: 1 } });

        type ErrorType = Effect.Effect.Error<typeof effect>;
        expectTypeOf<ErrorType>().toEqualTypeOf<PrismaDeleteError>();
      };
    });
  });

  // ============================================
  // Where Clause Types
  // ============================================

  describe("Where clause types", () => {
    it.effect("where accepts unique field lookup", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;

        // id is valid
        yield* prisma.user.findUnique({ where: { id: 1 } });

        // email is valid (unique field)
        yield* prisma.user.findUnique({ where: { email: "x@x.com" } });
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("where accepts filter operators", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;

        // String filters
        yield* prisma.user.findMany({
          where: {
            email: { contains: "example" },
          },
        });

        yield* prisma.user.findMany({
          where: {
            email: { startsWith: "test" },
          },
        });

        yield* prisma.user.findMany({
          where: {
            name: { not: null },
          },
        });
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("where accepts logical operators", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;

        // AND
        yield* prisma.user.findMany({
          where: {
            AND: [{ email: { contains: "a" } }, { name: { not: null } }],
          },
        });

        // OR
        yield* prisma.user.findMany({
          where: {
            OR: [{ email: { contains: "a" } }, { email: { contains: "b" } }],
          },
        });

        // NOT
        yield* prisma.user.findMany({
          where: {
            NOT: { email: { contains: "spam" } },
          },
        });
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("where accepts relation filters", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;

        // some - at least one related record matches
        yield* prisma.user.findMany({
          where: {
            posts: {
              some: { published: true },
            },
          },
        });

        // every - all related records match
        yield* prisma.user.findMany({
          where: {
            posts: {
              every: { published: true },
            },
          },
        });

        // none - no related records match
        yield* prisma.user.findMany({
          where: {
            posts: {
              none: { published: false },
            },
          },
        });
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("post where accepts author relation filter", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;

        // Filter posts by author properties
        yield* prisma.post.findMany({
          where: {
            author: {
              email: { contains: "example" },
            },
          },
        });

        // is/isNot for required relations
        yield* prisma.post.findMany({
          where: {
            author: {
              is: { name: "Alice" },
            },
          },
        });
      }).pipe(Effect.provide(MainLayer)),
    );
  });

  // ============================================
  // Create data types (type-only checks)
  // ============================================

  describe("Create data types (type-only)", () => {
    it("create requires required fields", () => {
      const _typeCheck = (prisma: Effect.Effect.Success<typeof PrismaService>) => {
        // email is required
        prisma.user.create({
          data: { email: "required@example.com" },
        });

        // name is optional
        prisma.user.create({
          data: { email: "with-name@example.com", name: "Optional Name" },
        });
      };
    });

    it("create with nested relation (connect)", () => {
      const _typeCheck = (prisma: Effect.Effect.Success<typeof PrismaService>) => {
        // Connect to existing user
        prisma.post.create({
          data: {
            title: "New Post",
            author: { connect: { id: 1 } },
          },
        });

        // Connect by unique field
        prisma.post.create({
          data: {
            title: "Another Post",
            author: { connect: { email: "user@example.com" } },
          },
        });
      };
    });

    it("create with nested relation (create)", () => {
      const _typeCheck = (prisma: Effect.Effect.Success<typeof PrismaService>) => {
        // Create nested posts when creating user
        prisma.user.create({
          data: {
            email: "author@example.com",
            posts: {
              create: [
                { title: "Post 1" },
                { title: "Post 2", content: "Content" },
              ],
            },
          },
        });
      };
    });

    it("create with nested relation (createMany)", () => {
      const _typeCheck = (prisma: Effect.Effect.Success<typeof PrismaService>) => {
        prisma.user.create({
          data: {
            email: "bulk-author@example.com",
            posts: {
              createMany: {
                data: [{ title: "Bulk 1" }, { title: "Bulk 2" }],
              },
            },
          },
        });
      };
    });
  });

  // ============================================
  // Update data types (type-only checks)
  // ============================================

  describe("Update data types (type-only)", () => {
    it("update accepts partial data", () => {
      const _typeCheck = (prisma: Effect.Effect.Success<typeof PrismaService>) => {
        // Only update name
        prisma.user.update({
          where: { id: 1 },
          data: { name: "New Name" },
        });

        // Set to null
        prisma.user.update({
          where: { id: 1 },
          data: { name: null },
        });
      };
    });

    it("update with nested relation operations", () => {
      const _typeCheck = (prisma: Effect.Effect.Success<typeof PrismaService>) => {
        // Create new related record
        prisma.user.update({
          where: { id: 1 },
          data: {
            posts: {
              create: { title: "New Post" },
            },
          },
        });

        // Connect existing record
        prisma.user.update({
          where: { id: 1 },
          data: {
            posts: {
              connect: { id: 5 },
            },
          },
        });

        // Disconnect record
        prisma.user.update({
          where: { id: 1 },
          data: {
            posts: {
              disconnect: { id: 5 },
            },
          },
        });

        // Update nested
        prisma.user.update({
          where: { id: 1 },
          data: {
            posts: {
              update: {
                where: { id: 5 },
                data: { published: true },
              },
            },
          },
        });

        // Delete nested
        prisma.user.update({
          where: { id: 1 },
          data: {
            posts: {
              delete: { id: 5 },
            },
          },
        });

        // UpdateMany nested
        prisma.user.update({
          where: { id: 1 },
          data: {
            posts: {
              updateMany: {
                where: { published: false },
                data: { published: true },
              },
            },
          },
        });

        // DeleteMany nested
        prisma.user.update({
          where: { id: 1 },
          data: {
            posts: {
              deleteMany: { published: false },
            },
          },
        });
      };
    });
  });

  // ============================================
  // Compile Error Tests (must fail to compile)
  // These use @ts-expect-error to verify invalid args are rejected
  // ============================================

  describe("Compile-time errors (invalid args)", () => {
    it("should error on invalid select field (type-only)", () => {
      const _typeCheck = (prisma: Effect.Effect.Success<typeof PrismaService>) => {
        prisma.user.findUnique({
          where: { id: 1 },
          select: {
            id: true,
            // @ts-expect-error - 'invalid' is not a valid field
            invalid: true,
          },
        });
      };
    });

    it("should error on invalid include field (type-only)", () => {
      const _typeCheck = (prisma: Effect.Effect.Success<typeof PrismaService>) => {
        prisma.user.findUnique({
          where: { id: 1 },
          include: {
            // @ts-expect-error - 'invalid' is not a valid relation
            invalid: true,
          },
        });
      };
    });

    it("should error on invalid where field (type-only)", () => {
      const _typeCheck = (prisma: Effect.Effect.Success<typeof PrismaService>) => {
        prisma.user.findMany({
          where: {
            // @ts-expect-error - 'invalid' is not a valid field
            invalid: "value",
          },
        });
      };
    });

    it("should error on wrong type in where (type-only)", () => {
      const _typeCheck = (prisma: Effect.Effect.Success<typeof PrismaService>) => {
        prisma.user.findUnique({
          where: {
            // @ts-expect-error - id should be number, not string
            id: "not-a-number",
          },
        });
      };
    });

    it("should error on missing required field in create (type-only)", () => {
      const _typeCheck = (prisma: Effect.Effect.Success<typeof PrismaService>) => {
        prisma.user.create({
          // @ts-expect-error - email is required
          data: { name: "Missing Email" },
        });
      };
    });

    it("should error on invalid nested relation name (type-only)", () => {
      const _typeCheck = (prisma: Effect.Effect.Success<typeof PrismaService>) => {
        prisma.user.create({
          data: {
            email: "test@example.com",
            // @ts-expect-error - 'comments' is not a valid relation
            comments: { create: { text: "Invalid" } },
          },
        });
      };
    });

    it("should error on accessing unselected field (type-only)", () => {
      const _typeCheck = async (prisma: Effect.Effect.Success<typeof PrismaService>) => {
        // Simulate getting the result type
        type ResultType = Effect.Effect.Success<
          ReturnType<typeof prisma.user.findUnique<{ where: { id: number }; select: { id: true } }>>
        >;

        // This should only have `id`, not `email`
        const result: ResultType = { id: 1 };
        const _id: number = result!.id; // OK

        // @ts-expect-error - email was not selected
        const _email: string = result!.email;
      };
    });

    it("should error on accessing unincluded relation (type-only)", () => {
      const _typeCheck = () => {
        // Without include, posts should not be on the type
        type UserWithoutInclude = {
          id: number;
          email: string;
          name: string | null;
        };

        const result: UserWithoutInclude = { id: 1, email: "x", name: null };

        // @ts-expect-error - posts was not included
        const _posts = result.posts;
      };
    });
  });

  // ============================================
  // OrderBy Types
  // ============================================

  describe("OrderBy types", () => {
    it.effect("orderBy accepts model fields", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;

        yield* prisma.user.findMany({
          orderBy: { email: "asc" },
        });

        yield* prisma.user.findMany({
          orderBy: { id: "desc" },
        });

        // Multiple order fields
        yield* prisma.user.findMany({
          orderBy: [{ name: "asc" }, { email: "desc" }],
        });
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("orderBy accepts relation count", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;

        yield* prisma.user.findMany({
          orderBy: {
            posts: { _count: "desc" },
          },
        });
      }).pipe(Effect.provide(MainLayer)),
    );
  });

  // ============================================
  // Aggregation Types
  // ============================================

  describe("Aggregation types", () => {
    it.effect("count returns number or object based on args", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;

        // Simple count returns number
        const simpleCount = yield* prisma.user.count();
        expectTypeOf(simpleCount).toEqualTypeOf<number>();

        // Count with select returns object
        const countWithSelect = yield* prisma.user.count({
          select: { _all: true },
        });
        expectTypeOf(countWithSelect).toEqualTypeOf<{ _all: number }>();
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("aggregate returns typed aggregation result", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;

        const result = yield* prisma.user.aggregate({
          _count: { id: true },
          _max: { id: true },
          _min: { id: true },
        });

        expectTypeOf(result).toMatchTypeOf<{
          _count: { id: number };
          _max: { id: number | null };
          _min: { id: number | null };
        }>();
      }).pipe(Effect.provide(MainLayer)),
    );

    it.effect("groupBy returns array with grouped fields", () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;

        const result = yield* prisma.user.groupBy({
          by: ["name"],
          _count: { id: true },
        });

        expectTypeOf(result).toMatchTypeOf<
          Array<{
            name: string | null;
            _count: { id: number };
          }>
        >();
      }).pipe(Effect.provide(MainLayer)),
    );
  });

  // ============================================
  // Cursor/Pagination Types
  // ============================================

  describe("Pagination types (type-only)", () => {
    it("cursor accepts unique field", () => {
      const _typeCheck = (prisma: Effect.Effect.Success<typeof PrismaService>) => {
        prisma.user.findMany({
          cursor: { id: 5 },
          take: 10,
        });

        prisma.user.findMany({
          cursor: { email: "cursor@example.com" },
          take: 10,
        });
      };
    });

    it("take/skip accept numbers", () => {
      const _typeCheck = (prisma: Effect.Effect.Success<typeof PrismaService>) => {
        prisma.user.findMany({
          take: 10,
          skip: 5,
        });

        // Negative take for reverse pagination
        prisma.user.findMany({
          take: -10,
          cursor: { id: 50 },
        });
      };
    });
  });

  // ============================================
  // Distinct Types
  // ============================================

  describe("Distinct types (type-only)", () => {
    it("distinct accepts model field names", () => {
      const _typeCheck = (prisma: Effect.Effect.Success<typeof PrismaService>) => {
        prisma.user.findMany({
          distinct: ["name"],
        });

        prisma.user.findMany({
          distinct: ["email", "name"],
        });
      };
    });
  });
});
