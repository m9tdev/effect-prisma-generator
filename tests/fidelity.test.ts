// Type-level contract for extended-client fidelity: providing a client built
// with client.$extends(...) to makePrismaService must yield methods whose
// results reflect the extension. Enforced by the suite's `tsc --noEmit`; the
// vitest run only confirms the file executes.
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any --
   type-level assertions produce type-only values and infer through any */
import { describe, expect, expectTypeOf, it } from "vitest";
import { Effect } from "effect";
import { Prisma, PrismaClient } from "./prisma/generated/client";
import {
  type ExtendedPrismaClientLike,
  makePrismaService,
} from "./prisma/generated/effect";

type Ok<E> = E extends Effect.Effect<infer A, any, any> ? A : never;

declare const base: PrismaClient;

// Never executed — the assertions are checked by tsc, not at runtime.
const _typeAssertions = () => {
  // A result extension adding a computed field to User.
  const extended = base.$extends({
    result: {
      user: {
        upperEmail: {
          needs: { email: true },
          compute: (user) => user.email.toUpperCase(),
        },
      },
    },
  });

  const extendedService = makePrismaService(extended);
  const plainService = makePrismaService(base);

  // The extension's computed field is selectable and flows through to the
  // result, alongside the model's own scalars.
  const withComputed = extendedService.user.findFirst({
    select: { upperEmail: true, name: true },
  });
  expectTypeOf<Ok<typeof withComputed>>().branded.toEqualTypeOf<{
    upperEmail: string;
    name: string | null;
  } | null>();

  // The extended field is also present when selecting the whole row.
  const wholeRow = extendedService.user.findFirst({ where: { id: 1 } });
  expectTypeOf<Ok<typeof wholeRow>>().branded.toEqualTypeOf<{
    id: number;
    email: string;
    name: string | null;
    upperEmail: string;
  } | null>();

  // Instantiated at a plain PrismaClient, the same factory yields exactly the
  // base types — no extension field leaks in.
  const plain = plainService.user.findFirst({ where: { id: 1 } });
  expectTypeOf<Ok<typeof plain>>().branded.toEqualTypeOf<{
    id: number;
    email: string;
    name: string | null;
  } | null>();

  // Global omit options of the client apply to results, as on the client.
  const omitting = null as unknown as PrismaClient<
    never,
    { user: { email: true } }
  >;
  const omitted = makePrismaService(omitting).user.findFirst({
    where: { id: 1 },
  });
  expectTypeOf<Ok<typeof omitted>>().branded.toEqualTypeOf<{
    id: number;
    name: string | null;
  } | null>();
  // ...and a query can include the field again, as on the client.
  const reincluded = makePrismaService(omitting).user.findFirst({
    omit: { email: false },
  });
  expectTypeOf<Ok<typeof reincluded>>().branded.toEqualTypeOf<{
    id: number;
    email: string;
    name: string | null;
  } | null>();
  // Extended clients keep the base client's global omit.
  const omittingExtended = makePrismaService(
    omitting.$extends({
      result: {
        user: {
          upperName: {
            needs: { name: true },
            compute: (user) => user.name?.toUpperCase() ?? null,
          },
        },
      },
    }),
  ).user.findFirst({ where: { id: 1 } });
  expectTypeOf<Ok<typeof omittingExtended>>().branded.toEqualTypeOf<{
    id: number;
    name: string | null;
    upperName: string | null;
  } | null>();

  // A client without Prisma's delegate types would type every argument as
  // any, so it is rejected.
  const loose = null as unknown as ExtendedPrismaClientLike;
  // @ts-expect-error - delegates typed as unknown
  makePrismaService(loose);
  const emptyMock = {
    ...loose,
    user: {},
    post: {},
    embedding: {},
    user_account: {},
  };
  // @ts-expect-error - hand-written mock with empty delegates
  makePrismaService(emptyMock);

  // Known limit (documented in the README): args come from the client's type
  // map, so args that a model extension adds to an existing method, such as
  // Accelerate's cacheStrategy, are not accepted by the service.
  const withExtraArg = base.$extends({
    model: {
      $allModels: {
        findMany<T, A>(
          this: T,
          args?: Prisma.Exact<
            A,
            Prisma.Args<T, "findMany"> & { cacheStrategy?: { ttl: number } }
          >,
        ): Prisma.PrismaPromise<Prisma.Result<T, A, "findMany">> {
          return (Prisma.getExtensionContext(this) as any).findMany(args);
        },
      },
    },
  });
  withExtraArg.user.findMany({ cacheStrategy: { ttl: 60 } });
  // @ts-expect-error - extension arg not in the type map
  makePrismaService(withExtraArg).user.findMany({ cacheStrategy: { ttl: 60 } });
};

describe("extended-client fidelity contract", () => {
  it("compiles (assertions are enforced by tsc --noEmit)", () => {
    expect(typeof _typeAssertions).toBe("function");
  });
});
