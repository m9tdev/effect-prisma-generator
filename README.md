# Effect Prisma Generator

A Prisma generator that creates a fully-typed, Effect-based service wrapper for your Prisma Client.

## Features

- 🚀 **Effect Integration**: All Prisma operations are wrapped in `Effect` for robust error handling and composability.
- 🛡️ **Type Safety**: Full TypeScript support with generated types matching your Prisma schema.
- 🧩 **Dependency Injection**: Integrates seamlessly with Effect's `Layer` and `Context` system.
- 🔍 **Error Handling**: Automatically catches and wraps Prisma errors into specific typed Effect errors.

## Installation

Install the generator as a development dependency:

```bash
npm install -D effect-prisma-generator
# or
pnpm add -D effect-prisma-generator
# or
yarn add -D effect-prisma-generator
```

`effect` and `@prisma/client` are peer dependencies — install them in your project alongside Prisma.

### Effect version support

The generator supports both **Effect v3** and **Effect v4 (beta)** from a single package. It detects the `effect` version installed in your project and emits matching code, so you don't need a special install:

- **Effect v3** → uses `Context.Tag` and the auto-generated `PrismaService.Default` layer.
- **Effect v4** → uses `Context.Service` and exposes `PrismaService.layer`.

> Effect v4 is still in beta and its APIs may shift between releases, so v4 output is considered experimental.

If detection ever picks the wrong major (or `effect` can't be resolved — in which case it defaults to v3), set it explicitly in the generator block:

```prisma
generator effect {
  provider         = "effect-prisma-generator"
  output           = "./generated/effect.ts"
  clientImportPath = "./client"
  effectVersion    = "4" // "3" or "4"; omit to auto-detect
}
```

## Configuration

Add the generator to your `schema.prisma` file:

```prisma
// prisma/schema.prisma
generator client {
  provider        = "prisma-client"
  output          = "./generated"
}

generator effect {
  provider = "effect-prisma-generator"
  output   = "./generated/effect.ts" // relative to the schema.prisma file
  clientImportPath = "./client" // relative to the output path ^
}
```

Then run `prisma generate` to generate the client and the Effect service.

### Recommendation (optional)

Add the following to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "paths": {
      "~prisma/*": ["./prisma/generated/*"]
    }
  }
}
```

Then you can import the generated PrismaService (and PrismaClient) like this:

```typescript
import { PrismaClient } from "~prisma/client";
import { PrismaService } from "~prisma/effect";
```

Otherwise, you can import the generated types like this (adjust the path accordingly):

```typescript
import { PrismaClient } from "../../prisma/generated/client";
import { PrismaService } from "../../prisma/generated/effect";
```

## Usage

### 1. Provide the Layer

Initialize the `PrismaClient` and provide it to the generated `PrismaService` layer as a `PrismaClientService`. The layer accessor depends on your Effect version: `PrismaService.Default` on v3, `PrismaService.layer` on v4.

```typescript
import { Effect, Layer } from "effect";
import { PrismaService, PrismaClientService } from "~prisma/effect";

// ... in your program
const prisma = new PrismaClient({ adapter });
const PrismaLayer = Layer.provide(
  PrismaService.Default, // on Effect v4, use PrismaService.layer
  Layer.succeed(PrismaClientService, prisma),
);
```

#### Extended clients (`$extends`)

A client created with `client.$extends(...)` — for example with
`@prisma/extension-accelerate` — has a static type that is not assignable to
`PrismaClient`, so `Layer.succeed(PrismaClientService, extended)` does not
typecheck. Use the generated `layerFromPrismaClient` instead, which accepts
plain and extended clients:

```typescript
import { PrismaService, layerFromPrismaClient } from "~prisma/effect";
import { withAccelerate } from "@prisma/extension-accelerate";

const prisma = new PrismaClient().$extends(withAccelerate());
const PrismaLayer = Layer.provide(
  PrismaService.Default, // on Effect v4, use PrismaService.layer
  layerFromPrismaClient(prisma),
);
```

At runtime all operations go through the extended client and behave per the
extension. Note that an extension's type-level changes are **not** reflected
in the service's types:

- Result extensions' computed fields don't appear on the service's return
  types.
- Extension-specific query arguments are rejected by the service's typed
  methods — for Accelerate that means per-query caching config such as
  `cacheStrategy` cannot be passed through the service without a cast; use
  the extended client directly (keep your own reference to it) for those
  queries.

`PrismaClientService` stays typed as `PrismaClient`, so lifecycle methods
remain available through the service — `$connect()`, `$disconnect()`, and
batch `$transaction` all exist on extended clients too. The one exception is
`$on`: Prisma strips event listening from extended clients, so call `$on` on
the base client *before* `$extends` (per Prisma's own guidance) rather than
through the service when it was provided an extended client.

### 2. Use the Service

Access the `PrismaService` in your Effect programs.

```typescript
import { PrismaService } from "./generated/effect";
import { Effect } from "effect";

const program = Effect.gen(function* () {
  const prisma = yield* PrismaService;

  // All standard Prisma operations are available
  const users = yield* prisma.user.findMany({
    where: { active: true },
    select: {
      id: true,
      accounts: {
        select: {
          id: true,
        },
      },
    },
  });
  // users: { id: string, accounts: { id: string }[] }[]

  return users;
});
```

## API

The generated `PrismaService` mirrors your Prisma Client API but returns `Effect<SpecificPrismaResultType, PrismaError, never>` instead of Promises, where `PrismaError` is a specific union type based on the operation (e.g., `PrismaCreateError`, `PrismaUpdateError`, `PrismaFindError`).

### Error Handling

All operations return an `Effect` that can fail with specific Prisma errors. The generator maps Prisma's error codes to typed Effect errors.

Each operation type (create, update, delete, find, etc.) returns a specific union of possible errors.

#### Available Errors

- `PrismaUniqueConstraintError`
- `PrismaForeignKeyConstraintError`
- `PrismaRecordNotFoundError`
- `PrismaRelationViolationError`
- `PrismaRelatedRecordNotFoundError`
- `PrismaTransactionConflictError`
- `PrismaValueTooLongError`
- `PrismaValueOutOfRangeError`
- `PrismaDbConstraintError`
- `PrismaConnectionError`
- `PrismaMissingRequiredValueError`
- `PrismaInputValidationError`

All errors carry the following context:

```typescript
{
  cause: Prisma.PrismaClientKnownRequestError;
  operation: string; // e.g. "create", "findUnique"
  model: string; // e.g. "User", "Post"
}
```

#### Example

```typescript
import { PrismaService, PrismaUniqueConstraintError } from "./generated/effect";
import { Effect } from "effect";

const program = Effect.gen(function* () {
  const prisma = yield* PrismaService;

  yield* prisma.user
    .create({
      data: { email: "test@example.com", name: "Test" },
    })
    .pipe(
      Effect.catchTag("PrismaUniqueConstraintError", (error) =>
        Effect.logError(`User with email already exists: ${error.model}`),
      ),
    );
});
```

### Transactions

The generated service includes a `$transaction` method that allows you to run multiple operations within a database transaction.

```typescript
const program = Effect.gen(function* () {
  const prisma = yield* PrismaService;

  yield* prisma.$transaction(
    Effect.gen(function* () {
      const user = yield* prisma.user.create({ data: { name: "Alice" } });
      yield* prisma.post.create({
        data: { title: "Hello", authorId: user.id },
      });
    }),
  );
});
```

### Nested Transactions

The `$transaction` method supports nesting. If you call `$transaction` within an existing transaction, it will reuse the parent transaction context. If any operation fails, the entire transaction (including the parent) is rolled back.

```typescript
const program = Effect.gen(function* () {
  const prisma = yield* PrismaService;

  yield* prisma.$transaction(
    Effect.gen(function* () {
      // Operation 1
      yield* prisma.user.create({ data: { name: "Parent" } });

      // Nested transaction
      yield* prisma.$transaction(
        Effect.gen(function* () {
          // Operation 2
          yield* prisma.user.create({ data: { name: "Child" } });
        }),
      );
    }),
  );
});
```

## Development

```bash
npm install
npm test
```

The integration tests under `tests/` are an isolated package with their own
`effect` version, so the generator can be exercised against both Effect v3 and
v4. `npm test` installs the `tests/` fixtures on first run (defaulting to the
Effect v4 line); CI runs the suite against both majors via a matrix that swaps
the `tests/` `effect` / `@effect/vitest` versions.
