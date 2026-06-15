import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Console, Effect, FileSystem } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

const run = (cwd: string, cmd: string, ...args: string[]) =>
  Effect.gen(function* () {
    yield* Console.log(cmd, ...args);
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const exitCode = yield* spawner.exitCode(
      ChildProcess.make(cmd, args, {
        cwd,
        stdout: "inherit",
        stderr: "inherit",
      }),
    );
    if (exitCode !== 0) {
      return yield* Effect.fail(
        new Error(`Command failed with exit code ${exitCode}`),
      );
    }
    return exitCode;
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
  yield* run("./tests/no-typedsql", "prisma", "generate");
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
  Effect.scoped(program.pipe(Effect.provide(NodeServices.layer))),
);
