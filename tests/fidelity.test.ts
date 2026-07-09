// Type-level contract for extended-client fidelity: providing a client built
// with client.$extends(...) to makePrismaService must yield methods whose
// results reflect the extension. Enforced by the suite's `tsc --noEmit`; the
// vitest run only confirms the file executes.
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any --
   type-level assertions produce type-only values and infer through any */
import { describe, expect, expectTypeOf, it } from "vitest";
import { Effect } from "effect";
import { PrismaClient } from "./prisma/generated/client";
import {
  definePrismaService,
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

  // definePrismaService: the ergonomic front door carries the same fidelity —
  // yielding the tag gives operations typed against the client it was defined
  // for, extension fields included.
  const { service: Db, layer } = definePrismaService<typeof extended>();
  const program = Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.user.findFirst({ select: { upperEmail: true } });
  }).pipe(Effect.provide(layer(extended)));
  expectTypeOf<Ok<typeof program>>().branded.toEqualTypeOf<{
    upperEmail: string;
  } | null>();
};

describe("extended-client fidelity contract", () => {
  it("compiles (assertions are enforced by tsc --noEmit)", () => {
    expect(typeof _typeAssertions).toBe("function");
  });
});
