// Type-level contract for the generated service's result types. These
// assertions pin the shapes consumers rely on, so the emission style can
// change without silently changing what call sites infer. They bite in the
// suite's `tsc --noEmit` step; the vitest run only confirms the file executes.
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any --
   type-level assertions produce type-only values and infer through any */
import { describe, expect, expectTypeOf, it } from "vitest";
import { Effect } from "effect";
import { PrismaService } from "./prisma/generated/effect";

const serviceEffect = Effect.gen(function* () {
  return yield* PrismaService;
});
type Ok<E> = E extends Effect.Effect<infer A, any, any> ? A : never;
type Service = Ok<typeof serviceEffect>;

declare const service: Service;

// Never executed — the assertions are checked by tsc, not at runtime.
const _typeAssertions = () => {
  // findMany with nested select: exact element shape
  const usersWithPostTitles = service.user.findMany({
    select: { id: true, posts: { select: { title: true } } },
  });
  expectTypeOf<Ok<typeof usersWithPostTitles>>().toEqualTypeOf<
    Array<{ id: number; posts: Array<{ title: string }> }>
  >();

  // findMany without args-affecting select: full scalars, no relations
  const plainUsers = service.user.findMany({ where: { email: "x" } });
  expectTypeOf<Ok<typeof plainUsers>>().toEqualTypeOf<
    Array<{ id: number; email: string; name: string | null }>
  >();

  // findUnique with include: nullable result carrying the relation
  const userWithPosts = service.user.findUnique({
    where: { id: 1 },
    include: { posts: true },
  });
  expectTypeOf<Ok<typeof userWithPosts>>().branded.toEqualTypeOf<{
    id: number;
    email: string;
    name: string | null;
    posts: Array<{
      id: number;
      title: string;
      content: string | null;
      authorId: number;
    }>;
  } | null>();

  // findFirst with _count select
  const firstUserWithCount = service.user.findFirst({
    select: { name: true, _count: { select: { posts: true } } },
  });
  expectTypeOf<Ok<typeof firstUserWithCount>>().toEqualTypeOf<{
    name: string | null;
    _count: { posts: number };
  } | null>();

  // findUniqueOrThrow: non-nullable
  const requiredUser = service.user.findUniqueOrThrow({ where: { id: 1 } });
  expectTypeOf<Ok<typeof requiredUser>>().toEqualTypeOf<{
    id: number;
    email: string;
    name: string | null;
  }>();

  // findFirstOrThrow: non-nullable, like findUniqueOrThrow
  const requiredFirstUser = service.user.findFirstOrThrow({
    where: { id: 1 },
    select: { email: true },
  });
  expectTypeOf<Ok<typeof requiredFirstUser>>().toEqualTypeOf<{ email: string }>();

  // create with nested create and select
  const created = service.user.create({
    data: { email: "a@b.c", posts: { create: [{ title: "t" }] } },
    select: { id: true, posts: { select: { id: true } } },
  });
  expectTypeOf<Ok<typeof created>>().toEqualTypeOf<{
    id: number;
    posts: Array<{ id: number }>;
  }>();

  // update with include on the relation's other side
  const updated = service.post.update({
    where: { id: 1 },
    data: { title: "t2" },
    include: { author: { select: { email: true } } },
  });
  expectTypeOf<Ok<typeof updated>>().branded.toEqualTypeOf<{
    id: number;
    title: string;
    content: string | null;
    authorId: number;
    author: { email: string };
  }>();

  // upsert
  const upserted = service.user.upsert({
    where: { id: 1 },
    create: { email: "a@b.c" },
    update: { name: "n" },
    select: { email: true },
  });
  expectTypeOf<Ok<typeof upserted>>().toEqualTypeOf<{ email: string }>();

  // delete / deleteMany / updateMany / createMany
  const deleted = service.post.delete({ where: { id: 1 }, select: { id: true } });
  expectTypeOf<Ok<typeof deleted>>().toEqualTypeOf<{ id: number }>();
  const deletedMany = service.post.deleteMany({ where: { authorId: 1 } });
  expectTypeOf<Ok<typeof deletedMany>>().toEqualTypeOf<{ count: number }>();
  const updatedMany = service.post.updateMany({
    where: { authorId: 1 },
    data: { title: "t" },
  });
  expectTypeOf<Ok<typeof updatedMany>>().toEqualTypeOf<{ count: number }>();
  const createdMany = service.post.createMany({
    data: [{ title: "t", authorId: 1 }],
  });
  expectTypeOf<Ok<typeof createdMany>>().toEqualTypeOf<{ count: number }>();

  // createManyAndReturn / updateManyAndReturn: array of the affected rows
  const createdAndReturned = service.post.createManyAndReturn({
    data: [{ title: "t", authorId: 1 }],
    select: { id: true },
  });
  expectTypeOf<Ok<typeof createdAndReturned>>().toEqualTypeOf<
    Array<{ id: number }>
  >();
  const updatedAndReturned = service.post.updateManyAndReturn({
    where: { authorId: 1 },
    data: { title: "t" },
  });
  expectTypeOf<Ok<typeof updatedAndReturned>>().branded.toEqualTypeOf<
    Array<{ id: number; title: string; content: string | null; authorId: number }>
  >();

  // count: plain number, and object form with select
  const countPlain = service.post.count({ where: { authorId: 1 } });
  expectTypeOf<Ok<typeof countPlain>>().toEqualTypeOf<number>();
  const countSelect = service.post.count({
    select: { _all: true, content: true },
  });
  expectTypeOf<Ok<typeof countSelect>>().toEqualTypeOf<{
    _all: number;
    content: number;
  }>();

  // aggregate: only requested aggregations appear
  const aggregated = service.user.aggregate({
    _count: true,
    _min: { id: true },
    _max: { email: true },
  });
  expectTypeOf<Ok<typeof aggregated>>().toEqualTypeOf<{
    _count: number;
    _min: { id: number | null };
    _max: { email: string | null };
  }>();

  // aggregate on the snake_case model, where Prisma capitalizes the first
  // letter of the generated type names
  const aggregatedSnake = service.user_account.aggregate({
    _avg: { score: true },
    _sum: { score: true },
  });
  expectTypeOf<Ok<typeof aggregatedSnake>>().toEqualTypeOf<{
    _avg: { score: number | null };
    _sum: { score: number | null };
  }>();

  // groupBy: by-fields plus requested aggregations
  const grouped = service.post.groupBy({
    by: ["authorId"],
    _count: { _all: true },
    _max: { id: true },
  });
  expectTypeOf<Ok<typeof grouped>>().branded.toEqualTypeOf<
    Array<{
      authorId: number;
      _count: { _all: number };
      _max: { id: number | null };
    }>
  >();

  // groupBy on the snake_case model
  const groupedSnake = service.user_account.groupBy({
    by: ["email"],
    _count: true,
  });
  expectTypeOf<Ok<typeof groupedSnake>>().branded.toEqualTypeOf<
    Array<{ email: string; _count: number }>
  >();

  // groupBy input validation: orderBy fields must appear in "by", and take
  // requires orderBy. These pin the rules the shared GroupBy* helpers encode,
  // so the per-model signature can't silently stop enforcing them.
  // @ts-expect-error - "id" ordered but not in "by"
  service.post.groupBy({ by: ["authorId"], orderBy: { id: "asc" } });
  // @ts-expect-error - "take" without "orderBy"
  service.post.groupBy({ by: ["authorId"], take: 5 });

  // Unsupported-field model: reads exist (vector is excluded from results),
  // create-family operations don't.
  const embeddings = service.embedding.findMany({});
  expectTypeOf<Ok<typeof embeddings>>().toEqualTypeOf<Array<{ id: number }>>();
  expectTypeOf(service.embedding).not.toHaveProperty("create");
  expectTypeOf(service.embedding).not.toHaveProperty("createMany");
  expectTypeOf(service.embedding).not.toHaveProperty("createManyAndReturn");
  expectTypeOf(service.embedding).not.toHaveProperty("upsert");
  expectTypeOf(service.embedding).toHaveProperty("findMany");

  // Strictness: unknown/excess properties are rejected, in fresh literals
  // and — via Prisma.SelectSubset — in widened non-literal args too.
  // @ts-expect-error - unknown field in where
  service.user.findMany({ where: { bogus: 1 } });
  // @ts-expect-error - excess top-level property
  service.user.findMany({ where: { email: "x" }, bogus: true });
  const widenedArgs = { where: { email: "x" }, bogus: true };
  // @ts-expect-error - excess property survives widening
  service.user.findMany(widenedArgs);

  // distinct + orderBy + take don't perturb the result type
  const distinctPosts = service.post.findMany({
    distinct: ["authorId"],
    orderBy: { id: "asc" },
    take: 5,
    select: { authorId: true },
  });
  expectTypeOf<Ok<typeof distinctPosts>>().toEqualTypeOf<
    Array<{ authorId: number }>
  >();
};

describe("generated service type contract", () => {
  it("compiles (assertions are enforced by tsc --noEmit)", () => {
    expect(typeof _typeAssertions).toBe("function");
  });
});
