import {
  LEVELS,
  LEVEL_MAX,
  VERSION,
  calcTask,
  choose,
  evaluate,
  initialState,
  numericDecision,
  openingFacts,
  openingSaleTarget,
  scoreCalc,
  seasonReport,
  type GameState,
} from "./engine";
import { optionText } from "./catalog";

export interface Run {
  campaignVersion: string;
  mode: "learning" | "competition";
  difficulty?: "light" | "medium" | "advanced";
  game: GameState;
  level: number;
  attempt: number;
  score: number;
  stars: number;
  xp: number;
  phase: "decision" | "result" | "finished";
  result?: {
    points: number;
    stars: number;
    xp: number;
    components: {
      goal: number;
      efficiency: number;
      safety: number;
      penalty: number;
      calc?: number;
    };
    before: GameState;
    after: GameState;
    /** Решение числом (продвинутый уровень), в единицах ввода. */
    custom?: number;
    /** Расчёт студента (средний и продвинутый уровни). */
    calc?: {
      question: string;
      unit: string;
      formula: string;
      answer: number;
      digits: number;
      given: number;
      score: number;
    };
  };
  checkpoint?: { game: GameState; score: number; stars: number; xp: number };
  completed: { level: number; points: number; stars: number; cash?: number; profit?: number }[];
}
export class GameError extends Error {
  constructor(
    message: string,
    public status = 400,
    public details?: { obligation: number; arrears: number; penalty: number },
  ) {
    super(message);
  }
}
export function newRun(
  mode: Run["mode"],
  attempt = 1,
): Run {
  return {
    campaignVersion: VERSION,
    mode,
    game: initialState(),
    level: 1,
    attempt,
    score: 0,
    stars: 0,
    xp: 0,
    phase: "decision",
    completed: [],
  };
}
export function view(
  farm: { id: string; name: string; version: number; state: unknown },
  practice = false,
) {
  const run = farm.state as Run;
  if (run.campaignVersion !== VERSION)
    throw new GameError(
      "Начни новое прохождение для этой версии игры.",
      409,
    );
  const level = LEVELS[run.level - 1];
  const difficulty = run.difficulty ?? "light";
  // На среднем и продвинутом уровнях последствия вариантов заранее не показываются.
  const open = difficulty === "light";
  const decision =
    run.phase === "decision" ? evaluate(run.game, run.level) : null;
  const entry = decision?.entry ?? run.game;
  const task = decision && !open ? calcTask(entry, run.level) : null;
  const choices =
    decision?.choices.map((r, index) => ({
      index,
      ...optionText(r.option, entry, run.level),
      facts: open ? openingFacts(run.level, entry, r.state) : [],
      preview: open ? r.state : entry,
      parameters: r.option.repair
        ? {
            repair: String(r.option.repair),
            storage: String(r.option.storage),
          }
        : undefined,
    })) ?? [];
  const result = run.result;
  const known = (g: GameState) => g.auto ?? [];
  const auto = decision
    ? known(entry).filter((x) => !known(run.game).includes(x))
    : result
      ? known(result.after).filter((x) => !known(result.before).includes(x))
      : [];
  const reviewed = result
    ? evaluate(result.before, run.level, result.custom)
    : null;
  const chosen = result ? JSON.stringify(result.after) : "";
  const review =
    reviewed?.choices.map((r, index) => ({
      index,
      ...optionText(r.option, result!.before, run.level),
      points: r.points,
      stars: r.stars,
      facts: openingFacts(run.level, result!.before, r.state),
      chosen: JSON.stringify(r.state) === chosen,
    })) ?? [];
  const shown = result?.after ?? entry;
  return {
    farmId: farm.id,
    farmName: farm.name,
    version: farm.version,
    mode: run.mode,
    difficulty,
    task: task && { question: task.question, unit: task.unit, digits: task.digits },
    numeric:
      decision && difficulty === "advanced"
        ? numericDecision(entry, run.level)
        : null,
    attempt: run.attempt,
    levelNumber: run.level,
    level,
    state: entry,
    phase: run.phase,
    score: run.score,
    stars: run.stars,
    xp: run.xp,
    completed: run.completed,
    choices,
    saleTarget: openingSaleTarget(run.level, result?.before ?? entry),
    result: result && {
      ...result,
      facts: openingFacts(run.level, result.before, result.after),
    },
    practice,
    auto,
    review,
    report: seasonReport(shown),
    seasonEnd: LEVELS[run.level]?.season !== level?.season,
    total: LEVELS.length,
  };
}
export function transition(
  before: Run,
  action: string,
  index = 0,
  allowHelp = false,
  extra: { calc?: number; value?: number } = {},
): Run {
  const run = structuredClone(before);
  if (action === "choose") {
    if (run.phase !== "decision")
      throw new GameError("Решение этого уровня уже сохранено.", 409);
    const difficulty = run.difficulty ?? "light",
      entry = evaluate(run.game, run.level).entry;
    // Продвинутый уровень: часть решений студент вводит числом.
    let custom: number | undefined;
    const range =
      difficulty === "advanced" ? numericDecision(entry, run.level) : null;
    if (range) {
      if (typeof extra.value !== "number" || !Number.isFinite(extra.value))
        throw new GameError("Введи своё решение числом.");
      if (extra.value < range.min || extra.value > range.max)
        throw new GameError(
          `Введи число от ${range.min} до ${range.max} ${range.unit}.`,
        );
      custom = extra.value;
    }
    // Средний и продвинутый уровни: перед решением студент сам выполняет расчёт.
    let calc: NonNullable<Run["result"]>["calc"];
    if (difficulty !== "light") {
      if (typeof extra.calc !== "number" || !Number.isFinite(extra.calc))
        throw new GameError("Сначала выполни расчёт и введи ответ.");
      const task = calcTask(entry, run.level);
      calc = { ...task, given: extra.calc, score: scoreCalc(task, extra.calc) };
    }
    let result;
    try {
      result = choose(run.game, run.level, index, allowHelp, custom);
    } catch (err) {
      if (err instanceof Error && err.message === "HELP_REQUIRED") {
        const preview = choose(run.game, run.level, index, true, custom);
        throw new GameError(
          "Для этого решения потребуется помощь. Возникнет обязательство с комиссией 5 % и штраф за каждую выдачу; неоплаченные выплаты останутся просрочкой.",
          422,
          {
            obligation: preview.state.s.assistance - run.game.s.assistance,
            arrears: Math.max(
              0,
              preview.state.s.arrears - run.game.s.arrears,
            ),
            penalty: preview.components.penalty,
          },
        );
      }
      throw err;
    }
    run.checkpoint = {
      game: run.game,
      score: run.score,
      stars: run.stars,
      xp: run.xp,
    };
    let points = result.points,
      stars = result.stars,
      xp = result.xp,
      components: NonNullable<Run["result"]>["components"] = result.components;
    if (calc) {
      // 70 % баллов уровня — за решение, 30 % — за расчёт.
      const k = (v: number) => Math.round(v * 0.7),
        c = result.components;
      components = {
        goal: k(c.goal),
        efficiency: k(c.efficiency),
        safety: k(c.safety),
        penalty: c.penalty,
        calc: Math.round(LEVEL_MAX * 0.3 * calc.score),
      };
      points = Math.max(
        0,
        components.goal +
          components.efficiency +
          components.safety +
          (components.calc ?? 0) -
          c.penalty,
      );
      stars =
        points >= LEVEL_MAX * 0.95
          ? 3
          : points >= LEVEL_MAX * 0.7
            ? 2
            : points >= LEVEL_MAX * 0.4
              ? 1
              : 0;
      xp = Math.round((points * 100) / LEVEL_MAX);
    }
    run.result = {
      points,
      stars,
      xp,
      components,
      before: entry,
      after: result.state,
      ...(custom !== undefined ? { custom } : {}),
      ...(calc ? { calc } : {}),
    };
    run.game = result.state;
    run.score += points;
    run.stars += stars;
    run.xp += xp;
    run.phase = "result";
  } else if (action === "repeat") {
    if (
      run.mode !== "learning" ||
      (run.difficulty ?? "light") !== "light" ||
      run.phase !== "result" ||
      !run.checkpoint
    )
      throw new GameError("Повтор текущего уровня недоступен.", 403);
    Object.assign(run, run.checkpoint);
    run.phase = "decision";
    delete run.result;
    delete run.checkpoint;
  } else if (action === "continue") {
    if (run.phase !== "result" || !run.result)
      throw new GameError("Сначала прими решение.");
    run.completed.push({
      level: run.level,
      points: run.result.points,
      stars: run.result.stars,
      cash: run.game.s.cash,
      profit: run.game.s.earnings,
    });
    if (run.level === LEVELS.length) run.phase = "finished";
    else {
      run.level++;
      run.phase = "decision";
      delete run.result;
    }
    delete run.checkpoint;
  } else throw new GameError("Неизвестное действие.");
  return run;
}
