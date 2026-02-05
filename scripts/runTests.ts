import { Command, FileSystem } from "@effect/platform";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Console, Effect } from "effect";

const run = (cwd: string, cmd: string, ...args: string[]) =>
  Effect.gen(function* () {
    yield* Console.log(cmd, ...args);
    yield* Command.make(cmd, ...args).pipe(
      Command.workingDirectory(cwd),
      Command.stdout("inherit"),
      Command.stderr("inherit"),
      Command.exitCode,
      Effect.map((exitCode) => {
        if (exitCode !== 0) {
          return Effect.fail(
            new Error(`Command failed with exit code ${exitCode}`),
          );
        }
        return exitCode;
      }),
    );
  });

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const clean = process.argv.includes("--clean");

  const distExists = yield* fs.exists("dist/");
  if (clean || !distExists) {
    yield* run(".", "npm", "run", "build");
  }
  if (clean) {
    yield* run(".", "tsc", "--noEmit");
  }
  const dbExists = yield* fs.exists("tests/prisma/dev.db");
  if (clean || !dbExists) {
    yield* run("./tests", "prisma", "db", "push");
  }
  yield* run("./tests", "prisma", "generate", "--sql");
  yield* run("./tests", "tsc", "--noEmit");
  yield* run("./tests", "vitest", "run");
}).pipe(
  Effect.ensuring(
    process.argv.includes("--keep-db")
      ? Effect.void
      : Effect.ignore(run("./tests", "rm", "-f", "prisma/dev.db")),
  ),
);

NodeRuntime.runMain(
  Effect.scoped(program.pipe(Effect.provide(NodeContext.layer))),
);
