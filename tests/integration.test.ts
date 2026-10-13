import { describe, expect, it } from "@effect/vitest";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { Data, Effect, Layer } from "effect";
import * as fs from "fs";
import { PrismaClient } from "./prisma/generated/client";
import {
  definePrismaService,
  layerFromPrismaClient,
  makePrismaService,
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
  // The generated PrismaService exposes its layer as `.Default` on effect v3
  // and `.layer` on effect v4; pick whichever this leg's effect provides.
  const { layer, Default } = PrismaService as unknown as {
    layer?: Layer.Layer<PrismaService, never, PrismaClientService>;
    Default?: Layer.Layer<PrismaService, never, PrismaClientService>;
  };
  const serviceLayer = layer ?? Default;
  if (serviceLayer === undefined) {
    throw new Error("PrismaService exposes neither .layer nor .Default");
  }
  const MainLayer = Layer.provide(
    serviceLayer,
    Layer.succeed(PrismaClientService, prisma),
  );

  it("suppresses type checking and linting in generated output by default", () => {
    const generatedSource = fs.readFileSync(
      "prisma/generated/effect.ts",
      "utf8",
    );

    expect(generatedSource).toContain("// @ts-nocheck");
    expect(generatedSource).toContain("/* eslint-disable */");
    expect(generatedSource).toContain("// biome-ignore-all lint");
  });

  it("omits suppression directives when noCheck = false", () => {
    const generatedSource = fs.readFileSync(
      "no-typedsql/generated/effect.ts",
      "utf8",
    );

    expect(generatedSource).not.toContain("// @ts-nocheck");
    expect(generatedSource).not.toContain("eslint-disable");
    expect(generatedSource).not.toContain("biome-ignore");
  });

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

  it.effect("should support aggregate and groupBy on a snake_case model", () =>
    Effect.gen(function* () {
      const prisma = yield* PrismaService;
      yield* prisma.user_account.create({
        data: { email: `acct-1-${Date.now()}@example.com`, score: 10 },
      });
      yield* prisma.user_account.create({
        data: { email: `acct-2-${Date.now()}@example.com`, score: 20 },
      });

      const aggregate = yield* prisma.user_account.aggregate({
        _sum: { score: true },
        _avg: { score: true },
      });
      expect(aggregate._sum.score).toBe(30);
      expect(aggregate._avg.score).toBe(15);

      const grouped = yield* prisma.user_account.groupBy({
        by: ["score"],
        _count: true,
        orderBy: { score: "asc" },
      });
      expect(grouped.length).toBe(2);
      expect(grouped[0].score).toBe(10);
      expect(grouped[1].score).toBe(20);

      yield* prisma.user_account.deleteMany({});
    }).pipe(Effect.provide(MainLayer)),
  );

  it.effect("should filter by a field reference", () =>
    Effect.gen(function* () {
      const prisma = yield* PrismaService;
      const marker = `fieldref-${Date.now()}`;
      const selfNamed = `${marker}-self@example.com`;

      yield* Effect.gen(function* () {
        yield* prisma.user.create({
          data: { email: selfNamed, name: selfNamed },
        });
        yield* prisma.user.create({
          data: { email: `${marker}-other@example.com`, name: "someone else" },
        });

        const filter = {
          email: { startsWith: marker },
          name: { equals: prisma.user.fields.email },
        };

        const matches = yield* prisma.user.findMany({ where: filter });
        expect(matches.map((user) => user.email)).toEqual([selfNamed]);

        // The filter captured a base-client ref; the query below runs on the
        // transaction client, and the ref must still match there.
        const inTransaction = yield* prisma.$transaction(
          prisma.user.findMany({ where: filter }),
        );
        expect(inTransaction.map((user) => user.email)).toEqual([selfNamed]);
      }).pipe(
        Effect.ensuring(
          prisma.user
            .deleteMany({ where: { email: { startsWith: marker } } })
            .pipe(Effect.orDie),
        ),
      );
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
      const users = yield* prisma.$queryRawTyped(getUsersByName("%TypedSQL%"));

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
    // Type-only: the generated file never loads the Prisma runtime itself.
    expect(generated).toContain(
      'import type * as runtime from "@prisma/client/runtime/client"',
    );
  });

  it("should not include $queryRawTyped when typedSql preview feature is not enabled", () => {
    const generated = fs.readFileSync(
      "no-typedsql/generated/effect.ts",
      "utf-8",
    );
    expect(generated).not.toContain("$queryRawTyped");
    expect(generated).not.toContain(
      'import * as runtime from "@prisma/client/runtime/client"',
    );
  });

  it("should omit create operations for models with a required Unsupported field", () => {
    const generated = fs.readFileSync("prisma/generated/effect.ts", "utf-8");
    // Embedding has a required Unsupported("vector") field, so Prisma omits its
    // create/createMany/createManyAndReturn/upsert ops and their *Args types;
    // the service must skip those operations but keep the rest of the model.
    // "client.embedding.create" is a prefix of createMany/createManyAndReturn,
    // so this one assertion covers the whole create family.
    expect(generated).not.toContain("client.embedding.create");
    expect(generated).not.toContain("client.embedding.upsert");
    expect(generated).toContain("client.embedding.findMany");
    expect(generated).toContain("client.embedding.update");
    expect(generated).toContain("client.embedding.aggregate");
    // Normal models keep their create operations.
    expect(generated).toContain("client.user.create");
  });

  it.effect(
    "should read and aggregate a model with a required Unsupported field",
    () =>
      Effect.gen(function* () {
        const prisma = yield* PrismaService;
        const rows = yield* prisma.embedding.findMany({});
        expect(rows).toEqual([]);
        const count = yield* prisma.embedding.count({});
        expect(count).toBe(0);
      }).pipe(Effect.provide(MainLayer)),
  );

  it.effect("should accept an extended client ($extends)", () =>
    Effect.gen(function* () {
      const prisma = yield* PrismaService;
      const email = `extended-${Date.now()}@example.com`;

      const user = yield* prisma.user.create({
        data: { email, name: "Extended User" },
      });
      expect(user.email).toBe(email);

      // Transactions must work through the extended client too.
      yield* prisma.$transaction(
        prisma.user.update({
          where: { id: user.id },
          data: { name: "Extended User 2" },
        }),
      );
      const found = yield* prisma.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(found.name).toBe("Extended User 2");

      yield* prisma.user.delete({ where: { id: user.id } });
    }).pipe(
      Effect.provide(
        Layer.provide(
          serviceLayer,
          // Extended clients have type DynamicClientExtensionThis, which is
          // not assignable to PrismaClient; layerFromPrismaClient must accept
          // one without casts on the consumer side.
          layerFromPrismaClient(
            prisma.$extends({
              name: "test-extension",
              query: {
                $allModels: {
                  $allOperations: ({ args, query }) => query(args),
                },
              },
            }),
          ),
        ),
      ),
    ),
  );

  it.effect("should not touch delegates while building the layer", () =>
    Effect.gen(function* () {
      const service = yield* PrismaService;
      const users = yield* service.user.findMany({});
      expect(users).toEqual([{ id: 1, email: "a@b.c", name: null }]);
    }).pipe(
      Effect.provide(
        Layer.provide(
          serviceLayer,
          // Test doubles usually stub only the models under test, so building
          // the service must read nothing off the client — `fields` is a
          // getter for exactly this reason.
          layerFromPrismaClient({
            $transaction: async () => undefined,
            $queryRaw: async () => undefined,
            $executeRaw: async () => undefined,
            user: {
              findMany: async () => [{ id: 1, email: "a@b.c", name: null }],
            },
          } as unknown as PrismaClient),
        ),
      ),
    ),
  );

  it.effect(
    "should apply an extended client's result extension through makePrismaService, including inside a transaction",
    () =>
      Effect.gen(function* () {
        const extended = prisma.$extends({
          result: {
            user: {
              upperEmail: {
                needs: { email: true },
                compute: (user) => user.email.toUpperCase(),
              },
            },
          },
        });
        const db = makePrismaService(extended);
        const email = `fidelity-${Date.now()}@example.com`;

        yield* db.user.create({ data: { email, name: "Fidelity" } });

        // Outside a transaction: the computed field is applied at runtime and
        // its type is present (no cast needed to read it).
        const outside = yield* db.user.findUniqueOrThrow({
          where: { email },
          select: { upperEmail: true },
        });
        expect(outside.upperEmail).toBe(email.toUpperCase());

        // Inside a transaction the extension still applies — the extended
        // client propagates its extensions into the transaction callback, so
        // the TClient-fidelity return type is honest inside transactions too.
        const inside = yield* db.$transaction(
          db.user.findUniqueOrThrow({
            where: { email },
            select: { upperEmail: true },
          }),
        );
        expect(inside.upperEmail).toBe(email.toUpperCase());

        yield* db.user.delete({ where: { email } });
      }),
  );

  it.effect("should only join a transaction of the same client", () =>
    Effect.gen(function* () {
      // Fake clients: each operation reports which client ran it, so the test
      // sees where every operation was routed.
      const fakeClient = (name: string) => {
        const delegates = (runner: string) => ({
          user: { findMany: async () => runner },
        });
        const tx = delegates(`${name}:tx`);
        return {
          $transaction: async (run: (tx: unknown) => Promise<unknown>) =>
            run(tx),
          $queryRaw: async () => undefined,
          $executeRaw: async () => undefined,
          ...delegates(`${name}:base`),
        } as unknown as PrismaClient;
      };
      const clientA = fakeClient("a");
      const clientB = fakeClient("b");
      const serviceA = makePrismaService(clientA);
      const otherServiceA = makePrismaService(clientA);
      const serviceB = makePrismaService(clientB);
      const both = Effect.all([
        otherServiceA.user.findMany({}),
        serviceB.user.findMany({}),
      ]);

      // A service over the same client joins; one over another client does not.
      expect(yield* serviceA.$transaction(both)).toEqual(["a:tx", "b:base"]);
      // Nested transactions of two clients keep both open.
      expect(yield* serviceA.$transaction(serviceB.$transaction(both))).toEqual(
        ["a:tx", "b:tx"],
      );

      // The default PrismaService shares transactions with services over its
      // own client, in both directions.
      const defaultService = yield* PrismaService.pipe(
        Effect.provide(
          Layer.provide(serviceLayer, layerFromPrismaClient(clientA)),
        ),
      );
      expect(
        yield* defaultService.$transaction(
          Effect.all([
            serviceA.user.findMany({}),
            defaultService.user.findMany({}),
            serviceB.user.findMany({}),
          ]),
        ),
      ).toEqual(["a:tx", "a:tx", "b:base"]);
      expect(
        yield* serviceA.$transaction(defaultService.user.findMany({})),
      ).toBe("a:tx");
    }),
  );

  it.effect(
    "should run a service over an extended client outside another client's transaction",
    () =>
      Effect.gen(function* () {
        const prismaService = yield* PrismaService;
        const marker = `scoped-${Date.now()}`;
        const inScope = `${marker}-in@example.com`;
        // Query extension: scopes every findMany to one email (like a tenant
        // filter), plus a result extension.
        const scopedService = makePrismaService(
          prisma.$extends({
            query: {
              user: {
                findMany: ({ args, query }) =>
                  query({ ...args, where: { ...args.where, email: inScope } }),
              },
            },
            result: {
              user: {
                upperEmail: {
                  needs: { email: true },
                  compute: (user) => user.email.toUpperCase(),
                },
              },
            },
          }),
        );

        yield* Effect.gen(function* () {
          yield* prismaService.user.createMany({
            data: [{ email: inScope }, { email: `${marker}-out@example.com` }],
          });

          // Inside the default service's transaction, the extended service
          // must still apply its own extensions.
          const [scoped, upper] = yield* prismaService.$transaction(
            Effect.all([
              scopedService.user.findMany({
                where: { email: { startsWith: marker } },
              }),
              scopedService.user.findFirstOrThrow({
                where: { email: inScope },
                select: { upperEmail: true },
              }),
            ]),
          );
          expect(scoped.map((user) => user.email)).toEqual([inScope]);
          expect(upper.upperEmail).toBe(inScope.toUpperCase());
        }).pipe(
          Effect.ensuring(
            prismaService.user
              .deleteMany({ where: { email: { startsWith: marker } } })
              .pipe(Effect.orDie),
          ),
        );
      }).pipe(Effect.provide(MainLayer)),
  );

  it.effect("should provide services from definePrismaService by key", () =>
    Effect.gen(function* () {
      const extended = prisma.$extends({
        result: {
          user: {
            upperEmail: {
              needs: { email: true },
              compute: (user) => user.email.toUpperCase(),
            },
          },
        },
      });
      // The first service uses the default key.
      const Extended = definePrismaService<typeof extended>();
      const Plain = definePrismaService<PrismaClient>("Plain");
      const email = `defined-${Date.now()}@example.com`;

      yield* Effect.gen(function* () {
        const extendedService = yield* Extended.service;
        const plainService = yield* Plain.service;
        yield* plainService.user.create({ data: { email } });

        const withComputed = yield* extendedService.user.findUniqueOrThrow({
          where: { email },
        });
        expect(withComputed.upperEmail).toBe(email.toUpperCase());
        const plainRow = yield* plainService.user.findUniqueOrThrow({
          where: { email },
        });
        expect(plainRow).not.toHaveProperty("upperEmail");

        yield* plainService.user.delete({ where: { email } });
      }).pipe(
        Effect.provide(
          Layer.mergeAll(Extended.layer(extended), Plain.layer(prisma)),
        ),
      );
    }),
  );

  it("should reject a key that is already defined, except in development", () => {
    const key = `duplicate-${Date.now()}`;
    definePrismaService<PrismaClient>(key);
    // vitest runs with NODE_ENV=test, where a second definition is a mistake.
    expect(() => definePrismaService<PrismaClient>(key)).toThrow(
      `definePrismaService: the key "${key}" is already defined.`,
    );

    // In development a hot reload runs the definition again, so it replaces
    // the old one.
    const environment = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    try {
      expect(definePrismaService<PrismaClient>(key).service.key).toBe(key);
    } finally {
      process.env.NODE_ENV = environment;
    }
  });

  it("should reject clients missing this schema's model delegates at compile time", () => {
    const wrongShapeClient = {
      $transaction: async () => undefined,
      $queryRaw: async () => undefined,
      $executeRaw: async () => undefined,
    };
    // @ts-expect-error — lacks the model delegate properties (user, post, ...),
    // so it satisfies neither PrismaClient nor ExtendedPrismaClientLike.
    const layer = layerFromPrismaClient(wrongShapeClient);
    expect(layer).toBeDefined();
  });
});
