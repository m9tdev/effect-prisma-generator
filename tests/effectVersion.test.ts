import { afterAll, describe, expect, it } from "@effect/vitest";
import { execFileSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// Runs the built generator in a throwaway project outside this repo, so the
// only `effect` it can find is the one the fixture installs (or none at all).
// Checks which major the emitted code targets.
const generator = path.resolve("../dist/index.js");
const prismaBin = path.resolve("../node_modules/.bin/prisma");
const fixtures: string[] = [];

const generate = (options: {
  installedEffect?: string;
  effectVersion?: string;
}) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "epg-effect-version-"));
  fixtures.push(dir);
  if (options.installedEffect !== undefined) {
    const pkgDir = path.join(dir, "node_modules", "effect");
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.writeFileSync(
      path.join(pkgDir, "package.json"),
      JSON.stringify({ name: "effect", version: options.installedEffect }),
    );
  }
  const effectVersionLine =
    options.effectVersion === undefined
      ? ""
      : `\n  effectVersion    = "${options.effectVersion}"`;
  fs.writeFileSync(
    path.join(dir, "schema.prisma"),
    `datasource db {
  provider = "sqlite"
}

generator effect {
  provider         = "node ${JSON.stringify(generator).slice(1, -1)}"
  output           = "./generated/effect.ts"
  clientImportPath = "./client"${effectVersionLine}
}

model User {
  id Int @id
}
`,
  );
  execFileSync(prismaBin, ["generate", "--schema", "schema.prisma"], {
    cwd: dir,
    stdio: "pipe",
  });
  const source = fs.readFileSync(
    path.join(dir, "generated", "effect.ts"),
    "utf8",
  );
  if (source.includes("static readonly layer = Layer.effect(")) {
    return 4;
  }
  if (source.includes(`import { Service } from "effect/Effect"`)) {
    return 3;
  }
  throw new Error("generated code matches neither effect v3 nor v4");
};

describe("effect version detection", () => {
  afterAll(() => {
    for (const dir of fixtures) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("emits v3 code when effect 3 is installed", () => {
    expect(generate({ installedEffect: "3.19.0" })).toBe(3);
  });

  it("emits v4 code when effect 4 is installed", () => {
    expect(generate({ installedEffect: "4.1.0" })).toBe(4);
  });

  it("emits v4 code when effect cannot be resolved", () => {
    expect(generate({})).toBe(4);
  });

  it("emits v4 code when the installed version cannot be parsed", () => {
    expect(generate({ installedEffect: "not-a-version" })).toBe(4);
  });

  it("lets effectVersion override the installed effect", () => {
    expect(generate({ installedEffect: "4.1.0", effectVersion: "3" })).toBe(3);
    expect(generate({ installedEffect: "3.19.0", effectVersion: "4" })).toBe(4);
  });
});
