import { makeVariant } from "./engine";
import { GameError, newRun, transition, view, type Run } from "./run";

export type View = ReturnType<typeof view>;

const welcome = { onboarding: true } as const;
let farm: { id: string; name: string; version: number; state: Run } | null = null;

export function play(body: Record<string, unknown> = { action: "get" }) {
  try {
    if (body.action === "reset") farm = null;
    if (body.action === "join") {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (name.length < 2 || name.length > 60) {
        throw new GameError("Напиши название хозяйства от 2 до 60 символов.");
      }
      const id = globalThis.crypto.randomUUID();
      const state = newRun("learning");
      state.difficulty = body.difficulty === "medium" || body.difficulty === "advanced"
        ? body.difficulty
        : "light";
      state.game.v = makeVariant(id);
      farm = { id, name, version: 0, state };
    } else if (body.action !== "get" && body.action !== "reset") {
      if (!farm) throw new GameError("Сначала начни игру.");
      const state = transition(
        farm.state,
        String(body.action),
        typeof body.index === "number" ? body.index : 0,
        body.allowHelp === true,
        {
          calc: typeof body.calc === "number" ? body.calc : undefined,
          value: typeof body.value === "number" ? body.value : undefined,
        },
      );
      farm = { ...farm, state, version: farm.version + 1 };
    }
    return { ok: true as const, data: farm ? view(farm) : welcome };
  } catch (error) {
    if (!(error instanceof GameError)) throw error;
    return {
      ok: false as const,
      status: error.status,
      data: { error: error.message, help: error.details },
    };
  }
}
