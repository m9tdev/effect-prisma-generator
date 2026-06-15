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

> **Compatibility:** The generated service targets **Effect v4** (`effect@4.0.0-beta.x`) and **Prisma 7**. Effect v4 is currently in beta, so expect API churn between betas. For Effect v3, use `effect-prisma-generator@0.8.x`.

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

Initialize the `PrismaClient` and provide it to the `PrismaService.layer` as a `PrismaClientService`.

```typescript
import { Effect, Layer } from "effect";
import { PrismaService, PrismaClientService } from "~prisma/effect";

// ... in your program
const prisma = new PrismaClient({ adapter });
const PrismaLayer = Layer.provide(
  PrismaService.layer,
  Layer.succeed(PrismaClientService, prisma),
);
```

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
