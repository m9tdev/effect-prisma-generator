/**
 * Type-level tests for the Effect Prisma Generator (Prisma 7)
 *
 * These tests verify that:
 * 1. Input args are correctly typed (select, include, where, etc.)
 * 2. Return types narrow correctly based on select/include
 * 3. Invalid args produce compile errors
 * 4. Relation selection works correctly
 *
 * NOTE: These are TYPE-ONLY tests. They verify TypeScript types at compile time
 * without executing actual database queries (which would require libsql timeouts).
 */

import { describe, expectTypeOf, it } from "@effect/vitest";
import { Effect } from "effect";
import {
  PrismaService,
  PrismaFindError,
  PrismaFindOrThrowError,
  PrismaCreateError,
  PrismaUpdateError,
  PrismaDeleteError,
} from "./generated/effect/index.js";

// Helper type to get PrismaService instance type
type Prisma = Effect.Effect.Success<typeof PrismaService>;

// ============================================
// Type-level tests - these verify types at compile time
// ============================================

describe("Type-level tests", () => {
  // ============================================
  // Return Type Inference
  // ============================================

  describe("Return type inference", () => {
    it("findUnique without select returns full model | null (type-only)", () => {
      const _typeCheck = (prisma: Prisma) => {
        const effect = prisma.user.findUnique({
          where: { id: 1 },
        });

        type ResultType = Effect.Effect.Success<typeof effect>;
        expectTypeOf<ResultType>().toEqualTypeOf<{
          id: number;
          email: string;
          name: string | null;
        } | null>();
      };
    });

    it("findUnique with select narrows to selected fields (type-only)", () => {
      const _typeCheck = (prisma: Prisma) => {
        const effect = prisma.user.findUnique({
          where: { id: 1 },
          select: { id: true, email: true },
        });

        type ResultType = Effect.Effect.Success<typeof effect>;
        expectTypeOf<ResultType>().toEqualTypeOf<{
          id: number;
          email: string;
        } | null>();
      };
    });

    it("findUniqueOrThrow returns non-null model (type-only)", () => {
      const _typeCheck = (prisma: Prisma) => {
        const effect = prisma.user.findUniqueOrThrow({
          where: { id: 1 },
        });

        type SuccessType = Effect.Effect.Success<typeof effect>;
        expectTypeOf<SuccessType>().toEqualTypeOf<{
          id: number;
          email: string;
          name: string | null;
        }>();
      };
    });

    it("findMany returns array of models (type-only)", () => {
      const _typeCheck = (prisma: Prisma) => {
        const effect = prisma.user.findMany();

        type ResultType = Effect.Effect.Success<typeof effect>;
        expectTypeOf<ResultType>().toEqualTypeOf<
          Array<{
            id: number;
            email: string;
            name: string | null;
          }>
        >();
      };
    });

    it("findMany with select returns array of narrowed type (type-only)", () => {
      const _typeCheck = (prisma: Prisma) => {
        const effect = prisma.user.findMany({
          select: { email: true },
        });

        type ResultType = Effect.Effect.Success<typeof effect>;
        expectTypeOf<ResultType>().toEqualTypeOf<Array<{ email: string }>>();
      };
    });

    it("create returns created model (type-only)", () => {
      const _typeCheck = (prisma: Prisma) => {
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
      const _typeCheck = (prisma: Prisma) => {
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
    it("include: { posts: true } adds posts array to return type (type-only)", () => {
      const _typeCheck = (prisma: Prisma) => {
        const effect = prisma.user.findUnique({
          where: { id: 1 },
          include: { posts: true },
        });

        type ResultType = Effect.Effect.Success<typeof effect>;
        expectTypeOf<ResultType>().toEqualTypeOf<{
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
      };
    });

    it("include with nested select narrows included relation (type-only)", () => {
      const _typeCheck = (prisma: Prisma) => {
        const effect = prisma.user.findUnique({
          where: { id: 1 },
          include: {
            posts: {
              select: { id: true, title: true },
            },
          },
        });

        type ResultType = Effect.Effect.Success<typeof effect>;
        expectTypeOf<ResultType>().toEqualTypeOf<{
          id: number;
          email: string;
          name: string | null;
          posts: Array<{ id: number; title: string }>;
        } | null>();
      };
    });

    it("post.findUnique with include: { author: true } adds author (type-only)", () => {
      const _typeCheck = (prisma: Prisma) => {
        const effect = prisma.post.findUnique({
          where: { id: 1 },
          include: { author: true },
        });

        type ResultType = Effect.Effect.Success<typeof effect>;
        expectTypeOf<ResultType>().toEqualTypeOf<{
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
      };
    });

    it("deeply nested include (author with posts) (type-only)", () => {
      const _typeCheck = (prisma: Prisma) => {
        const effect = prisma.post.findUnique({
          where: { id: 1 },
          include: {
            author: {
              include: { posts: true },
            },
          },
        });

        type ResultType = Effect.Effect.Success<typeof effect>;
        expectTypeOf<ResultType>().toEqualTypeOf<{
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
      };
    });
  });

  // ============================================
  // Select with Relations
  // ============================================

  describe("Select with relations", () => {
    it("select with nested relation select (type-only)", () => {
      const _typeCheck = (prisma: Prisma) => {
        const effect = prisma.user.findUnique({
          where: { id: 1 },
          select: {
            id: true,
            posts: {
              select: { title: true },
            },
          },
        });

        type ResultType = Effect.Effect.Success<typeof effect>;
        expectTypeOf<ResultType>().toEqualTypeOf<{
          id: number;
          posts: Array<{ title: string }>;
        } | null>();
      };
    });

    it("select with nested relation using variable for nested select (type-only)", () => {
      const _typeCheck = (prisma: Prisma) => {
        // Define a reusable select object for User fields
        const selectAuthor = {
          id: true,
          email: true,
        } as const;

        const effect = prisma.post.findUnique({
          where: { id: 1 },
          select: {
            id: true,
            title: true,
            author: {
              select: selectAuthor,
            },
          },
        });

        type ResultType = Effect.Effect.Success<typeof effect>;
        expectTypeOf<ResultType>().toEqualTypeOf<{
          id: number;
          title: string;
          author: {
            id: number;
            email: string;
          };
        } | null>();
      };
    });

    it("deeply nested select with variables (type-only)", () => {
      const _typeCheck = (prisma: Prisma) => {
        const selectPost = {
          id: true,
          title: true,
        } as const;

        const selectAuthorWithPosts = {
          id: true,
          email: true,
          posts: {
            select: selectPost,
          },
        } as const;

        const effect = prisma.post.findUnique({
          where: { id: 1 },
          select: {
            id: true,
            author: {
              select: selectAuthorWithPosts,
            },
          },
        });

        type ResultType = Effect.Effect.Success<typeof effect>;
        expectTypeOf<ResultType>().toEqualTypeOf<{
          id: number;
          author: {
            id: number;
            email: string;
            posts: Array<{
              id: number;
              title: string;
            }>;
          };
        } | null>();
      };
    });

    it("nested select result should be assignable to expected type (type-only)", () => {
      const _typeCheck = (prisma: Prisma) => {
        type ExpectedPostWithAuthor = {
          id: number;
          title: string;
          author: {
            id: number;
            email: string;
          };
        };

        const selectAuthor = {
          id: true,
          email: true,
        } as const;

        const effect = prisma.post.findUnique({
          where: { id: 1 },
          select: {
            id: true,
            title: true,
            author: {
              select: selectAuthor,
            },
          },
        });

        type ActualResult = Effect.Effect.Success<typeof effect>;
        type NonNullResult = NonNullable<ActualResult>;

        const _checkAssignable: NonNullResult = {} as ExpectedPostWithAuthor;

        type HasAuthor = NonNullResult extends { author: infer A } ? A : never;
        expectTypeOf<HasAuthor>().toEqualTypeOf<{ id: number; email: string }>();
      };
    });

    it("nested select WITHOUT as const should still infer correctly (type-only)", () => {
      const _typeCheck = (prisma: Prisma) => {
        const selectAuthor = {
          id: true,
          email: true,
        }; // No `as const`!

        const effect = prisma.post.findUnique({
          where: { id: 1 },
          select: {
            id: true,
            title: true,
            author: {
              select: selectAuthor,
            },
          },
        });

        type ActualResult = Effect.Effect.Success<typeof effect>;
        type NonNullResult = NonNullable<ActualResult>;

        type HasAuthor = NonNullResult extends { author: infer A } ? A : never;
        expectTypeOf<HasAuthor>().not.toBeNever();
      };
    });
  });

  // ============================================
  // Error Type Inference
  // ============================================

  describe("Error type inference", () => {
    it("findUnique has PrismaFindError error channel (type-only)", () => {
      const _typeCheck = (prisma: Prisma) => {
        const effect = prisma.user.findUnique({ where: { id: 1 } });

        type ErrorType = Effect.Effect.Error<typeof effect>;
        expectTypeOf<ErrorType>().toEqualTypeOf<PrismaFindError>();
      };
    });

    it("findUniqueOrThrow errors include PrismaFindOrThrowError (type-only)", () => {
      const _typeCheck = (prisma: Prisma) => {
        const effect = prisma.user.findUniqueOrThrow({ where: { id: 1 } });

        type ErrorType = Effect.Effect.Error<typeof effect>;
        expectTypeOf<ErrorType>().toEqualTypeOf<PrismaFindOrThrowError>();
      };
    });

    it("create errors include PrismaCreateError (type-only)", () => {
      const _typeCheck = (prisma: Prisma) => {
        const effect = prisma.user.create({ data: { email: "x@x.com" } });

        type ErrorType = Effect.Effect.Error<typeof effect>;
        expectTypeOf<ErrorType>().toEqualTypeOf<PrismaCreateError>();
      };
    });

    it("update errors include PrismaUpdateError (type-only)", () => {
      const _typeCheck = (prisma: Prisma) => {
        const effect = prisma.user.update({
          where: { id: 1 },
          data: { name: "New" },
        });

        type ErrorType = Effect.Effect.Error<typeof effect>;
        expectTypeOf<ErrorType>().toEqualTypeOf<PrismaUpdateError>();
      };
    });

    it("delete errors include PrismaDeleteError (type-only)", () => {
      const _typeCheck = (prisma: Prisma) => {
        const effect = prisma.user.delete({ where: { id: 1 } });

        type ErrorType = Effect.Effect.Error<typeof effect>;
        expectTypeOf<ErrorType>().toEqualTypeOf<PrismaDeleteError>();
      };
    });
  });

  // ============================================
  // Where Clause Types
  // ============================================

  describe("Where clause types (type-only)", () => {
    it("where accepts unique field lookup", () => {
      const _typeCheck = (prisma: Prisma) => {
        prisma.user.findUnique({ where: { id: 1 } });
        prisma.user.findUnique({ where: { email: "x@x.com" } });
      };
    });

    it("where accepts filter operators", () => {
      const _typeCheck = (prisma: Prisma) => {
        prisma.user.findMany({
          where: { email: { contains: "example" } },
        });
        prisma.user.findMany({
          where: { email: { startsWith: "test" } },
        });
        prisma.user.findMany({
          where: { name: { not: null } },
        });
      };
    });

    it("where accepts logical operators", () => {
      const _typeCheck = (prisma: Prisma) => {
        prisma.user.findMany({
          where: {
            AND: [{ email: { contains: "a" } }, { name: { not: null } }],
          },
        });
        prisma.user.findMany({
          where: {
            OR: [{ email: { contains: "a" } }, { email: { contains: "b" } }],
          },
        });
        prisma.user.findMany({
          where: {
            NOT: { email: { contains: "spam" } },
          },
        });
      };
    });

    it("where accepts relation filters", () => {
      const _typeCheck = (prisma: Prisma) => {
        prisma.user.findMany({
          where: { posts: { some: { published: true } } },
        });
        prisma.user.findMany({
          where: { posts: { every: { published: true } } },
        });
        prisma.user.findMany({
          where: { posts: { none: { published: false } } },
        });
      };
    });
  });

  // ============================================
  // Create data types
  // ============================================

  describe("Create data types (type-only)", () => {
    it("create requires required fields", () => {
      const _typeCheck = (prisma: Prisma) => {
        prisma.user.create({
          data: { email: "required@example.com" },
        });
        prisma.user.create({
          data: { email: "with-name@example.com", name: "Optional Name" },
        });
      };
    });

    it("create with nested relation (connect)", () => {
      const _typeCheck = (prisma: Prisma) => {
        prisma.post.create({
          data: {
            title: "New Post",
            author: { connect: { id: 1 } },
          },
        });
        prisma.post.create({
          data: {
            title: "Another Post",
            author: { connect: { email: "user@example.com" } },
          },
        });
      };
    });

    it("create with nested relation (create)", () => {
      const _typeCheck = (prisma: Prisma) => {
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
  });

  // ============================================
  // Update data types
  // ============================================

  describe("Update data types (type-only)", () => {
    it("update accepts partial data", () => {
      const _typeCheck = (prisma: Prisma) => {
        prisma.user.update({
          where: { id: 1 },
          data: { name: "New Name" },
        });
        prisma.user.update({
          where: { id: 1 },
          data: { name: null },
        });
      };
    });

    it("update with nested relation operations", () => {
      const _typeCheck = (prisma: Prisma) => {
        prisma.user.update({
          where: { id: 1 },
          data: { posts: { create: { title: "New Post" } } },
        });
        prisma.user.update({
          where: { id: 1 },
          data: { posts: { connect: { id: 5 } } },
        });
        prisma.user.update({
          where: { id: 1 },
          data: { posts: { disconnect: { id: 5 } } },
        });
      };
    });
  });

  // ============================================
  // Compile Error Tests
  // ============================================

  describe("Compile-time errors (invalid args)", () => {
    it("should error on invalid select field (type-only)", () => {
      const _typeCheck = (prisma: Prisma) => {
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
      const _typeCheck = (prisma: Prisma) => {
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
      const _typeCheck = (prisma: Prisma) => {
        prisma.user.findMany({
          where: {
            // @ts-expect-error - 'invalid' is not a valid field
            invalid: "value",
          },
        });
      };
    });

    it("should error on wrong type in where (type-only)", () => {
      const _typeCheck = (prisma: Prisma) => {
        prisma.user.findUnique({
          where: {
            // @ts-expect-error - id should be number, not string
            id: "not-a-number",
          },
        });
      };
    });

    it("should error on missing required field in create (type-only)", () => {
      const _typeCheck = (prisma: Prisma) => {
        prisma.user.create({
          // @ts-expect-error - email is required
          data: { name: "Missing Email" },
        });
      };
    });

    it("should error on invalid nested relation name (type-only)", () => {
      const _typeCheck = (prisma: Prisma) => {
        prisma.user.create({
          data: {
            email: "test@example.com",
            // @ts-expect-error - 'comments' is not a valid relation
            comments: { create: { text: "Invalid" } },
          },
        });
      };
    });
  });

  // ============================================
  // OrderBy Types
  // ============================================

  describe("OrderBy types (type-only)", () => {
    it("orderBy accepts model fields", () => {
      const _typeCheck = (prisma: Prisma) => {
        prisma.user.findMany({ orderBy: { email: "asc" } });
        prisma.user.findMany({ orderBy: { id: "desc" } });
        prisma.user.findMany({
          orderBy: [{ name: "asc" }, { email: "desc" }],
        });
      };
    });

    it("orderBy accepts relation count", () => {
      const _typeCheck = (prisma: Prisma) => {
        prisma.user.findMany({
          orderBy: { posts: { _count: "desc" } },
        });
      };
    });
  });

  // ============================================
  // Aggregation Types
  // ============================================

  describe("Aggregation types (type-only)", () => {
    it("count returns number or object based on args", () => {
      const _typeCheck = (prisma: Prisma) => {
        const simpleCount = prisma.user.count();
        type SimpleCountResult = Effect.Effect.Success<typeof simpleCount>;
        expectTypeOf<SimpleCountResult>().toEqualTypeOf<number>();

        const countWithSelect = prisma.user.count({
          select: { _all: true },
        });
        type CountWithSelectResult = Effect.Effect.Success<typeof countWithSelect>;
        expectTypeOf<CountWithSelectResult>().toEqualTypeOf<{ _all: number }>();
      };
    });

    it("aggregate returns typed aggregation result", () => {
      const _typeCheck = (prisma: Prisma) => {
        const effect = prisma.user.aggregate({
          _count: { id: true },
          _max: { id: true },
          _min: { id: true },
        });

        type ResultType = Effect.Effect.Success<typeof effect>;
        expectTypeOf<ResultType>().toMatchTypeOf<{
          _count: { id: number };
          _max: { id: number | null };
          _min: { id: number | null };
        }>();
      };
    });

    it("groupBy returns array with grouped fields", () => {
      const _typeCheck = (prisma: Prisma) => {
        const effect = prisma.user.groupBy({
          by: ["name"],
          _count: { id: true },
        });

        type ResultType = Effect.Effect.Success<typeof effect>;
        expectTypeOf<ResultType>().toMatchTypeOf<
          Array<{
            name: string | null;
            _count: { id: number };
          }>
        >();
      };
    });
  });

  // ============================================
  // Pagination Types
  // ============================================

  describe("Pagination types (type-only)", () => {
    it("cursor accepts unique field", () => {
      const _typeCheck = (prisma: Prisma) => {
        prisma.user.findMany({ cursor: { id: 5 }, take: 10 });
        prisma.user.findMany({ cursor: { email: "cursor@example.com" }, take: 10 });
      };
    });

    it("take/skip accept numbers", () => {
      const _typeCheck = (prisma: Prisma) => {
        prisma.user.findMany({ take: 10, skip: 5 });
        prisma.user.findMany({ take: -10, cursor: { id: 50 } });
      };
    });
  });

  // ============================================
  // Distinct Types
  // ============================================

  describe("Distinct types (type-only)", () => {
    it("distinct accepts model field names", () => {
      const _typeCheck = (prisma: Prisma) => {
        prisma.user.findMany({ distinct: ["name"] });
        prisma.user.findMany({ distinct: ["email", "name"] });
      };
    });
  });
});
