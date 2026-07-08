// Type-level contract for the generated service's result types. These
// assertions pin the shapes consumers rely on, so the emission style can
// change (e.g. frozen *Args/SelectSubset -> Prisma.Args/Prisma.Result)
// without silently changing what call sites infer. They bite in the suite's
// `tsc --noEmit` step; the vitest run only confirms the file executes.
import { describe, expect, expectTypeOf, it } from "vitest";
import { Effect } from "effect";
import { PrismaService } from "./prisma/generated/effect";

const svcEffect = Effect.gen(function* () {
  return yield* PrismaService;
});
type Ok<E> = E extends Effect.Effect<infer A, any, any> ? A : never;
type Svc = Ok<typeof svcEffect>;

declare const svc: Svc;

// Never executed — the assertions are checked by tsc, not at runtime.
const _typeAssertions = () => {
  // findMany with nested select: exact element shape
  const fmSelect = svc.user.findMany({
    select: { id: true, posts: { select: { title: true } } },
  });
  expectTypeOf<Ok<typeof fmSelect>>().toEqualTypeOf<
    Array<{ id: number; posts: Array<{ title: string }> }>
  >();

  // findMany without args-affecting select: full scalars, no relations
  const fmPlain = svc.user.findMany({ where: { email: "x" } });
  expectTypeOf<Ok<typeof fmPlain>>().toEqualTypeOf<
    Array<{ id: number; email: string; name: string | null }>
  >();

  // findUnique with include: nullable result carrying the relation
  const fu = svc.user.findUnique({
    where: { id: 1 },
    include: { posts: true },
  });
  expectTypeOf<Ok<typeof fu>>().branded.toEqualTypeOf<{
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
  const ff = svc.user.findFirst({
    select: { name: true, _count: { select: { posts: true } } },
  });
  expectTypeOf<Ok<typeof ff>>().toEqualTypeOf<{
    name: string | null;
    _count: { posts: number };
  } | null>();

  // findUniqueOrThrow: non-nullable
  const fut = svc.user.findUniqueOrThrow({ where: { id: 1 } });
  expectTypeOf<Ok<typeof fut>>().toEqualTypeOf<{
    id: number;
    email: string;
    name: string | null;
  }>();

  // create with nested create and select
  const created = svc.user.create({
    data: { email: "a@b.c", posts: { create: [{ title: "t" }] } },
    select: { id: true, posts: { select: { id: true } } },
  });
  expectTypeOf<Ok<typeof created>>().toEqualTypeOf<{
    id: number;
    posts: Array<{ id: number }>;
  }>();

  // update with include on the relation's other side
  const updated = svc.post.update({
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
  const upserted = svc.user.upsert({
    where: { id: 1 },
    create: { email: "a@b.c" },
    update: { name: "n" },
    select: { email: true },
  });
  expectTypeOf<Ok<typeof upserted>>().toEqualTypeOf<{ email: string }>();

  // delete / deleteMany / updateMany / createMany
  const deleted = svc.post.delete({ where: { id: 1 }, select: { id: true } });
  expectTypeOf<Ok<typeof deleted>>().toEqualTypeOf<{ id: number }>();
  const deletedMany = svc.post.deleteMany({ where: { authorId: 1 } });
  expectTypeOf<Ok<typeof deletedMany>>().toEqualTypeOf<{ count: number }>();
  const updatedMany = svc.post.updateMany({
    where: { authorId: 1 },
    data: { title: "t" },
  });
  expectTypeOf<Ok<typeof updatedMany>>().toEqualTypeOf<{ count: number }>();
  const createdMany = svc.post.createMany({
    data: [{ title: "t", authorId: 1 }],
  });
  expectTypeOf<Ok<typeof createdMany>>().toEqualTypeOf<{ count: number }>();

  // count: plain number, and object form with select
  const countPlain = svc.post.count({ where: { authorId: 1 } });
  expectTypeOf<Ok<typeof countPlain>>().toEqualTypeOf<number>();
  const countSelect = svc.post.count({
    select: { _all: true, content: true },
  });
  expectTypeOf<Ok<typeof countSelect>>().toEqualTypeOf<{
    _all: number;
    content: number;
  }>();

  // aggregate: only requested aggregations appear
  const agg = svc.user.aggregate({
    _count: true,
    _min: { id: true },
    _max: { email: true },
  });
  expectTypeOf<Ok<typeof agg>>().toEqualTypeOf<{
    _count: number;
    _min: { id: number | null };
    _max: { email: string | null };
  }>();

  // aggregate on the snake_case model (the #27 capitalization territory)
  const aggSnake = svc.user_account.aggregate({
    _avg: { score: true },
    _sum: { score: true },
  });
  expectTypeOf<Ok<typeof aggSnake>>().toEqualTypeOf<{
    _avg: { score: number | null };
    _sum: { score: number | null };
  }>();

  // groupBy: by-fields plus requested aggregations
  const grouped = svc.post.groupBy({
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
  const groupedSnake = svc.user_account.groupBy({
    by: ["email"],
    _count: true,
  });
  expectTypeOf<Ok<typeof groupedSnake>>().branded.toEqualTypeOf<
    Array<{ email: string; _count: number }>
  >();

  // Unsupported-field model: reads exist (vector is excluded from results),
  // create-family operations don't.
  const emb = svc.embedding.findMany({});
  expectTypeOf<Ok<typeof emb>>().toEqualTypeOf<Array<{ id: number }>>();
  type EmbeddingOps = keyof Svc["embedding"];
  expectTypeOf<"create" extends EmbeddingOps ? true : false>().toEqualTypeOf<false>();
  expectTypeOf<"createMany" extends EmbeddingOps ? true : false>().toEqualTypeOf<false>();
  expectTypeOf<"upsert" extends EmbeddingOps ? true : false>().toEqualTypeOf<false>();
  expectTypeOf<"findMany" extends EmbeddingOps ? true : false>().toEqualTypeOf<true>();

  // distinct + orderBy + take don't perturb the result type
  const distinct = svc.post.findMany({
    distinct: ["authorId"],
    orderBy: { id: "asc" },
    take: 5,
    select: { authorId: true },
  });
  expectTypeOf<Ok<typeof distinct>>().toEqualTypeOf<
    Array<{ authorId: number }>
  >();
};

describe("generated service type contract", () => {
  it("compiles (assertions are enforced by tsc --noEmit)", () => {
    expect(typeof _typeAssertions).toBe("function");
  });
});
