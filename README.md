# Effect Prisma Generator

A Prisma generator that creates a fully-typed, Effect-based service wrapper for your Prisma Client.

## Features

- 🚀 **Effect Integration**: All Prisma operations are wrapped in `Effect` for robust error handling and composability.
- 🛡️ **Type Safety**: Full TypeScript support with generated types matching your Prisma schema.
- 🧩 **Dependency Injection**: Integrates seamlessly with Effect's `Layer` and `Context` system.
- 🔍 **Error Handling**: Automatically catches and wraps Prisma errors into a typed `PrismaError`.

## Installation

Install the generator as a development dependency:

```bash
npm install -D effect-prisma-generator
# or
pnpm add -D effect-prisma-generator
# or
yarn add -D effect-prisma-generator
```

## Configuration

Add the generator to your `schema.prisma` file:

```prisma
// prisma/schema.prisma
generator client {
  provider        = "prisma-client-js"
}

generator effect {
  provider = "effect-prisma-generator"
  output   = "./generated/effect" // relative to the schema.prisma file, e.g. prisma/generated/effect
}
```

Then run `prisma generate` to generate the client and the Effect service.

### Recommended

Add the following to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "paths": {
      "@prisma/*": ["./prisma/generated/*"]
    }
  }
}
```

Then you can import the generated types like this:

```typescript
import { PrismaService } from "@prisma/effect";
```

Otherwise, you can import the generated types like this (adjust the path accordingly):

```typescript
import { PrismaService } from "../../prisma/generated/effect";
```

## Usage

### 1. Provide the Layer

First, provide the `LivePrismaLayer` in your application entry point or test setup.

```typescript
import { LivePrismaLayer } from "@prisma/effect";
import { Effect, Layer } from "effect";

// ... in your program
const MainLayer = Layer.mergeAll(
  LivePrismaLayer,
  // ... other layers
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

The generated `PrismaService` mirrors your Prisma Client API but returns `Effect<Success, PrismaError, Requirements>` instead of Promises.

### Error Handling

All operations return an `Effect` that can fail with `PrismaError`.

```typescript
export class PrismaError extends Data.TaggedError("PrismaError")<{
  error: unknown;
  operation: string;
  model: string;
}> {}
```

### Transactions

The generator supports sharing the transaction context via the `PrismaClientService` tag. You can create a helper to run effects within a Prisma transaction:

```typescript
import { Effect, Runtime } from "effect";
import {
  PrismaClientService,
  PrismaService,
  PrismaError,
} from "./generated/effect";

const runInTransaction = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.gen(function* () {
    // 1. Get the Prisma Client
    const { client } = yield* PrismaClientService;

    // 2. Capture the current Runtime to preserve context (services, fiber refs)
    const runtime = yield* Effect.runtime<R>();

    // 3. Execute the transaction
    return yield* Effect.tryPromise({
      try: () =>
        client.$transaction((tx) => {
          // 4. Run the effect using the captured runtime,
          // providing the transaction client to the service
          return Runtime.runPromise(runtime)(
            Effect.provideService(effect, PrismaClientService, { tx, client }),
          );
        }),
      catch: (error) =>
        new PrismaError({ error, operation: "transaction", model: "Prisma" }),
    });
  });

// Usage Example
const program = Effect.gen(function* () {
  const prisma = yield* PrismaService;

  yield* runInTransaction(
    Effect.gen(function* () {
      const user = yield* prisma.user.create({ data: { name: "Alice" } });
      yield* prisma.post.create({
        data: { title: "Hello", authorId: user.id },
      });
    }),
  );
});
```
