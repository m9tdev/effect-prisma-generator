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
  output          = "./generated/client"
}

generator effect {
  provider = "effect-prisma-generator"
  output   = "./generated/effect" // relative to the schema.prisma file, e.g. prisma/generated/effect
  clientImportPath = "../client" // relative to the output path ^here (defaults to "@prisma/client")
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

Operations return typed errors that you can handle with Effect's error handling utilities:

```typescript
import {
  PrismaService,
  PrismaUniqueConstraintError,
  PrismaRecordNotFoundError,
  PrismaForeignKeyConstraintError,
} from "@prisma/effect";

const program = Effect.gen(function* () {
  const prisma = yield* PrismaService;

  // Handle specific error types with catchTag
  const user = yield* prisma.user
    .create({ data: { email: "alice@example.com" } })
    .pipe(
      Effect.catchTag("PrismaUniqueConstraintError", (error) => {
        console.log(`Duplicate email: ${error.cause.code}`); // P2002
        return Effect.succeed(null);
      }),
    );

  // OrThrow methods return PrismaRecordNotFoundError
  const found = yield* prisma.user
    .findUniqueOrThrow({ where: { id: 999 } })
    .pipe(
      Effect.catchTag("PrismaRecordNotFoundError", () =>
        Effect.succeed(null),
      ),
    );
});
```

**Available error types:**

| Error Type | Prisma Code | When it occurs |
|------------|-------------|----------------|
| `PrismaUniqueConstraintError` | P2002 | Duplicate unique field |
| `PrismaRecordNotFoundError` | P2025 | `findUniqueOrThrow`, `findFirstOrThrow`, `update`, `delete` on non-existent |
| `PrismaForeignKeyConstraintError` | P2003 | Invalid foreign key reference |
| `PrismaValueTooLongError` | P2000 | Value exceeds column length |
| `PrismaDbConstraintError` | P2004 | Database constraint violation |
| `PrismaInputValidationError` | P2005, P2006, P2019 | Invalid input value |
| `PrismaMissingRequiredValueError` | P2011, P2012 | Required field is null |
| `PrismaRelationViolationError` | P2014 | Relation constraint violation |
| `PrismaRelatedRecordNotFoundError` | P2015, P2018 | Related record not found |
| `PrismaValueOutOfRangeError` | P2020 | Value out of range |
| `PrismaConnectionError` | P2024 | Connection pool timeout |
| `PrismaTransactionConflictError` | P2034 | Transaction conflict (retry) |

### Custom Error Mapping

If you want to use your own error type instead of the built-in tagged errors, you can configure `errorImportPath` in your schema:

```prisma
generator effect {
  provider         = "effect-prisma-generator"
  output           = "./generated/effect"
  clientImportPath = "../client"
  errorImportPath  = "./errors#MyPrismaError"  // relative to schema.prisma
}
```

> **Note:** The `errorImportPath` is relative to your `schema.prisma` file location, not the output directory. The generator automatically calculates the correct import path for the generated code.

Your error module must export:
1. **The error class** - Your custom error type
2. **A mapper function** named `mapPrismaError` - Maps raw errors to your type

```typescript
// errors.ts
import { Data } from "effect";
import { Prisma } from "@prisma/client";

export class MyPrismaError extends Data.TaggedError("MyPrismaError")<{
  cause: unknown;
  operation: string;
  model: string;
  code?: string;  // You can add custom fields
}> {}

export const mapPrismaError = (
  error: unknown,
  operation: string,
  model: string
): MyPrismaError => {
  // You can inspect the error and add custom handling
  const code = error instanceof Prisma.PrismaClientKnownRequestError
    ? error.code
    : undefined;

  // Option: throw unknown errors as defects
  // if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
  //   throw error;
  // }

  return new MyPrismaError({ cause: error, operation, model, code });
};
```

Now all operations will use your `MyPrismaError` type:

```typescript
import { PrismaService, MyPrismaError } from "./generated/effect";

const program = Effect.gen(function* () {
  const prisma = yield* PrismaService;

  // All errors are now MyPrismaError
  yield* prisma.user
    .create({ data: { email: "alice@example.com" } })
    .pipe(
      Effect.catchTag("MyPrismaError", (error) => {
        console.log(`Operation: ${error.operation}, Code: ${error.code}`);
        return Effect.succeed(null);
      }),
    );
});
```

This is useful when:
- Migrating from an existing codebase that uses a single error type
- You want to add custom fields/metadata to errors
- You want control over which errors are recoverable vs defects

### Transactions

The generated service includes a `$transaction` method that allows you to run multiple operations within a database transaction.

```typescript
const program = Effect.gen(function* () {
  const prisma = yield* PrismaService;

  const result = yield* prisma.$transaction(
    Effect.gen(function* () {
      const user = yield* prisma.user.create({ data: { name: "Alice" } });
      const post = yield* prisma.post.create({
        data: { title: "Hello", authorId: user.id },
      });
      return { user, post };
    }),
  );
});
```

#### Transaction Rollback Behavior

**Any uncaught error in the Effect error channel triggers a rollback:**

```typescript
// Rollback on Effect.fail()
yield* prisma.$transaction(
  Effect.gen(function* () {
    yield* prisma.user.create({ data: { email: "alice@example.com" } });
    yield* Effect.fail("Something went wrong"); // Triggers rollback
  }),
);
// User is NOT created

// Rollback on Prisma errors (e.g., findUniqueOrThrow)
yield* prisma.$transaction(
  Effect.gen(function* () {
    yield* prisma.user.create({ data: { email: "bob@example.com" } });
    yield* prisma.user.findUniqueOrThrow({ where: { id: 999 } }); // Throws!
  }),
);
// User is NOT created
```

**Catching errors prevents rollback:**

```typescript
yield* prisma.$transaction(
  Effect.gen(function* () {
    yield* prisma.user.create({ data: { email: "alice@example.com" } });

    // Catch the error - transaction continues
    yield* prisma.user
      .findUniqueOrThrow({ where: { id: 999 } })
      .pipe(Effect.catchAll(() => Effect.succeed(null)));

    yield* prisma.user.create({ data: { email: "bob@example.com" } });
  }),
);
// Both users ARE created
```

**Custom error types are preserved:**

```typescript
class MyError extends Data.TaggedError("MyError")<{ message: string }> {}

const error = yield* prisma
  .$transaction(Effect.fail(new MyError({ message: "oops" })))
  .pipe(Effect.flip);

expect(error).toBeInstanceOf(MyError); // Type is preserved!
```

### Nested Transactions

Nested `$transaction` calls share the **same underlying database transaction**. There are no savepoints - all operations run in a single transaction that commits or rolls back together.

```typescript
yield* prisma.$transaction(
  Effect.gen(function* () {
    yield* prisma.user.create({ data: { name: "Outer" } });

    yield* prisma.$transaction(
      Effect.gen(function* () {
        yield* prisma.user.create({ data: { name: "Inner" } });
      }),
    );

    yield* Effect.fail("Outer failure");
  }),
);
// BOTH users are rolled back
```

#### Key Behaviors

| Scenario | Result |
|----------|--------|
| Both succeed | All committed |
| Inner fails (uncaught) | All rollback |
| Inner succeeds, outer fails | All rollback |
| Inner fails (caught), outer succeeds | **All committed** (including inner's data!) |

> **Important:** When you catch an inner transaction's error, its writes are NOT rolled back because there are no savepoints. All operations share the same database transaction.

#### Composable Service Functions

Functions that use `$transaction` internally work seamlessly when called from an outer transaction:

```typescript
// Service function with its own transaction
const UserService = {
  createWithProfile: (email: string) =>
    Effect.gen(function* () {
      const prisma = yield* PrismaService;
      return yield* prisma.$transaction(
        Effect.gen(function* () {
          const user = yield* prisma.user.create({ data: { email } });
          yield* prisma.profile.create({ data: { userId: user.id } });
          return user;
        }),
      );
    }),
};

// Called standalone - creates its own transaction
yield* UserService.createWithProfile("alice@example.com");

// Called inside outer transaction - joins it
yield* prisma.$transaction(
  Effect.gen(function* () {
    yield* UserService.createWithProfile("alice@example.com");
    yield* UserService.createWithProfile("bob@example.com");
    // If anything fails, both users are rolled back
  }),
);
```

This pattern allows you to:
1. Write self-contained service functions that are safe to call standalone
2. Compose them in outer transactions for end-to-end atomicity
3. Functions don't need to know if they're inside another transaction

### Building Effect Services with PrismaService

You can build layered Effect services that wrap `PrismaService`. Transactions work correctly through any level of service composition.

```typescript
// Level 1: Repository layer
class UserRepo extends Effect.Service<UserRepo>()("UserRepo", {
  effect: Effect.gen(function* () {
    const db = yield* PrismaService;
    return {
      create: (email: string, name: string) =>
        db.user.create({ data: { email, name } }),
      findById: (id: number) =>
        db.user.findUnique({ where: { id } }),
    };
  }),
}) {}

class PostRepo extends Effect.Service<PostRepo>()("PostRepo", {
  effect: Effect.gen(function* () {
    const db = yield* PrismaService;
    return {
      create: (title: string, authorId: number) =>
        db.post.create({ data: { title, authorId } }),
    };
  }),
}) {}

// Level 2: Domain service composing repositories
class BlogService extends Effect.Service<BlogService>()("BlogService", {
  effect: Effect.gen(function* () {
    const users = yield* UserRepo;
    const posts = yield* PostRepo;
    const db = yield* PrismaService;

    return {
      createAuthorWithPost: (email: string, name: string, title: string) =>
        db.$transaction(
          Effect.gen(function* () {
            const user = yield* users.create(email, name);
            const post = yield* posts.create(title, user.id);
            return { user, post };
          }),
        ),
    };
  }),
}) {}

// Wire up the layers
const PrismaLayer = Layer.merge(LivePrismaLayer, PrismaService.Default);
const RepoLayer = Layer.merge(UserRepo.Default, PostRepo.Default).pipe(
  Layer.provide(PrismaLayer),
);
const ServiceLayer = BlogService.Default.pipe(
  Layer.provide(RepoLayer),
  Layer.provide(PrismaLayer),
);

// Use it
const program = Effect.gen(function* () {
  const blog = yield* BlogService;
  return yield* blog.createAuthorWithPost("alice@example.com", "Alice", "Hello World");
});

Effect.runPromise(program.pipe(Effect.provide(ServiceLayer)));
```

#### Why This Works

You might wonder: if `PrismaService` is captured at layer construction time, how do transactions work?

The key is **deferred execution**. When you call `db.user.create({ data })`, it doesn't execute immediately—it returns an **Effect** that describes what to do:

```typescript
// Generated code (simplified)
user: {
  create: (args) => Effect.flatMap(PrismaClientService, ({ tx: client }) =>
    Effect.tryPromise({ try: () => client.user.create(args), ... })
  )
}
```

The `Effect.flatMap(PrismaClientService, ...)` defers the lookup of `PrismaClientService` until the Effect actually runs. When `$transaction` executes an inner effect, it provides a new `PrismaClientService` with the transaction client:

```typescript
// Inside $transaction (simplified)
effect.pipe(Effect.provideService(PrismaClientService, { tx: transactionClient, client }))
```

So even though you capture `db` (the `PrismaService`) at layer construction, the actual database client lookup happens at execution time—inside the transaction scope.

This means:
- ✅ Services can store references to `PrismaService` at construction
- ✅ Services can store effect-returning methods (e.g., `const createUser = db.user.create`)
- ✅ Transactions work correctly through any number of service layers
- ✅ Nested `$transaction` calls properly join the outer transaction

### Resource Management

The `makePrismaLayer` function uses `Layer.scoped` with a finalizer to ensure the PrismaClient is properly disconnected when the layer scope ends:

```typescript
export const makePrismaLayer = <T extends ConstructorParameters<typeof PrismaClient>[0]>(
  options: T
) => Layer.scoped(
  PrismaClientService,
  Effect.gen(function* () {
    const prisma = new PrismaClient(options)
    yield* Effect.addFinalizer(() => Effect.promise(() => prisma.$disconnect()))
    return { tx: prisma, client: prisma }
  })
)
```

This means:
- The connection is automatically cleaned up when the program completes
- The connection is cleaned up even if the program fails
- Each scoped usage gets its own PrismaClient instance

```typescript
// Connection is automatically managed
const program = Effect.gen(function* () {
  const prisma = yield* PrismaService;
  yield* prisma.user.findMany();
  // ... more operations
});

// $disconnect is called automatically when this completes
await Effect.runPromise(
  program.pipe(
    Effect.provide(Layer.merge(LivePrismaLayer, PrismaService.Default)),
    Effect.scoped,
  )
);
```

For long-running applications (like servers), you typically provide the layer once at startup and it stays connected for the lifetime of the application.
