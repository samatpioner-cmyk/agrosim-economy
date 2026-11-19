import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const { outputFiles } = await build({
  absWorkingDir: fileURLToPath(root),
  stdin: {
    contents: `
      export * from "./game/src/game/engine.ts";
      export { newRun, transition } from "./game/src/game/run.ts";
      export { play } from "./game/src/game/play.ts";
    `,
    resolveDir: fileURLToPath(root),
  },
  bundle: true,
  format: "esm",
  write: false,
});
const core = await import("data:text/javascript;base64," + Buffer.from(outputFiles[0].text).toString("base64"));
const golden = JSON.parse(await readFile(new URL("game/src/game/golden.json", root), "utf8"));
const canonical = (value) => JSON.stringify(Object.entries(value).sort());

test("Все 16 эталонных решений дают 1000 баллов", () => {
  let run = core.newRun("learning");
  for (const expected of golden) {
    const { choices } = core.evaluate(run.game, expected.level);
    const index = choices.findIndex(({ option }) => canonical(option) === canonical(expected.choice));
    assert.ok(index >= 0);
    run = core.transition(run, "choose", index, true);
    assert.equal(run.result.points, expected.points);
    assert.equal(run.game.s.cash, expected.cash);
    run = core.transition(run, "continue");
  }
  assert.equal(run.phase, "finished");
  assert.equal(run.score, 100_000);
});

test("Сложность меняет условия принятия решений", () => {
  for (const difficulty of ["light", "medium", "advanced"]) {
    core.play({ action: "reset" });
    const start = core.play({ action: "join", name: "Учебная ферма", difficulty });
    assert.ok(start.ok);
    assert.equal(start.data.difficulty, difficulty);
    assert.equal(Boolean(start.data.task), difficulty !== "light");
    assert.equal(Boolean(start.data.numeric), difficulty === "advanced");
    const move = core.play({ action: "choose", index: 0, allowHelp: true });
    assert.equal(move.ok, difficulty === "light");
  }
  assert.deepEqual(core.play({ action: "reset" }).data, { onboarding: true });
});
