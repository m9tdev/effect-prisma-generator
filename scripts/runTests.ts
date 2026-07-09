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
  // tests/ is an isolated package with its own effect version (see
  // tests/package.json), so it isn't covered by the root install. Install it on
  // first run so `npm test` works after a plain clone. CI pre-installs the
  // matrix effect version, which leaves tests/node_modules present, so this is
  // skipped there and the chosen version is preserved.
  const testDepsExist = yield* fs.exists("tests/node_modules");
  if (!testDepsExist) {
    yield* run(
      "./tests",
      "npm",
      "install",
      "--legacy-peer-deps",
      "--no-package-lock",
    );
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
  // tsc has no flag to override `// @ts-nocheck`, so the suppressed default
  // output would go unchecked. Type-check a copy with the directive stripped,
  // placed next to the original so its relative imports still resolve; the
  // tests tsconfig picks it up via its `**/*` include.
  const generated = yield* fs.readFileString(
    "tests/prisma/generated/effect.ts",
  );
  const stripped = generated.replace("// @ts-nocheck\n", "");
  // If the directive text ever drifts from what we strip, the copy would stay
  // suppressed and this safety net would silently stop checking anything.
  if (stripped === generated) {
    return yield* Effect.fail(
      new Error("expected a // @ts-nocheck directive to strip from effect.ts"),
    );
  }
  yield* fs.writeFileString(
    "tests/prisma/generated/effect.checked.ts",
    stripped,
  );
  // The type-level contract (tests/typelevel.test.ts) and this stripped copy
  // are only enforced because the tests tsconfig type-checks the whole
  // directory. If its include is ever narrowed, tsc would silently stop
  // checking them while vitest stayed green, so guard the include here.
  const testsTsconfig = yield* fs.readFileString("tests/tsconfig.json");
  if (!JSON.parse(testsTsconfig).include?.includes("**/*")) {
    return yield* Effect.fail(
      new Error(
        'tests/tsconfig.json must include "**/*" so typelevel.test.ts and ' +
          "effect.checked.ts are type-checked by the tsc --noEmit step.",
      ),
    );
  }
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
