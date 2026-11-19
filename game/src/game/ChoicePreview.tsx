import type { GameState } from "./engine";
import { currency, tons } from "./catalog";

const sumR = (list: [number, number][]) => list.reduce((a, [, v]) => a + v, 0);

/** Что изменится в хозяйстве, если принять выбранный вариант. */
export default function ChoicePreview({
  before,
  after,
  title,
}: {
  before: GameState;
  after: GameState;
  title: string;
}) {
  const debt = (g: GameState) => g.s.debt + g.s.assistance + g.s.arrears;
  const rows: [string, number, number, "money" | "kg"][] = [
    ["Деньги на счёте", before.s.cash, after.s.cash, "money"],
    ["Накопленная прибыль", before.s.earnings, after.s.earnings, "money"],
    ["Зерно на складе", before.s.inventory, after.s.inventory, "kg"],
    ["Долги покупателей", sumR(before.s.receivables), sumR(after.s.receivables), "money"],
    ["Долг хозяйства", debt(before), debt(after), "money"],
  ];
  const visible = rows.filter(([, a, b], i) => i < 2 || a !== b);
  const capitalized = after.s.wip > before.s.wip && after.s.earnings === before.s.earnings;
  const help = after.s.help_episodes > before.s.help_episodes || after.s.arrears > before.s.arrears;
  return (
    <section className="choice-preview" aria-live="polite" aria-label="Что изменится">
      <header>
        <span>ЧТО ИЗМЕНИТСЯ</span>
        <strong>{title}</strong>
      </header>
      <div className="delta-rows">
        {visible.map(([label, a, b, unit]) => {
          const d = b - a;
          const fmt = (v: number) => (unit === "money" ? currency(v) : tons(v));
          return (
            <div className="delta-row" key={label}>
              <span>{label}</span>
              <b>{fmt(b)}</b>
              <em className={d > 0 ? "up" : d < 0 ? "down" : ""}>
                {d === 0 ? "без изменений" : `${d > 0 ? "+" : "−"}${fmt(Math.abs(d))}`}
              </em>
            </div>
          );
        })}
      </div>
      {capitalized && (
        <p className="note">
          Затраты на производство не уменьшают прибыль сразу. Они копятся в незавершённом производстве и войдут в
          себестоимость, когда урожай будет продан.
        </p>
      )}
      {help && (
        <p className="note warn">
          Денег не хватит на обязательные выплаты: понадобится экстренная помощь с комиссией и штрафом.
        </p>
      )}
    </section>
  );
}
