"use client";
import { useState } from "react";
export interface GroupChoice {
  index: number;
  title: string;
  detail: string;
  parameters?: { repair?: string; storage?: string };
}
export default function DecisionGroups({
  choices,
  busy,
  onSelect,
}: {
  choices: GroupChoice[];
  busy: boolean;
  onSelect: (index: number) => void;
}) {
  const [selection, setSelection] = useState<Record<string, string>>({});
  const axes = [
    { key: "repair" as const, title: "1. Как восстановить мощность?" },
    { key: "storage" as const, title: "2. Где разместить урожай?" },
  ];
  const repairNames: Record<string, string> = {
    repair: "Полный ремонт · 400 000 ₽",
    contractor: "Подрядчик · 450 000 ₽",
    partial: "Частичный ремонт · 250 000 ₽",
    skip: "Без ремонта · 0 ₽",
  };
  const storeNames: Record<string, string> = {
    own: "Свой склад · 1000 т",
    lease250: "Ещё 250 т · 50 000 ₽",
    lease500: "Ещё 500 т · 100 000 ₽",
  };
  const repairDetails: Record<string, string> = {
    repair: "100 % мощности на уборке",
    contractor: "100 % мощности силами подрядчика",
    partial: "85 % мощности на уборке",
    skip: "60 % мощности — часть урожая останется неубранной",
  };
  function select(key: string, value: string) {
    const next = { ...selection, [key]: value };
    setSelection(next);
    const match = choices.find(
      (c) =>
        c.parameters?.repair === next.repair &&
        c.parameters?.storage === next.storage,
    );
    if (match) onSelect(match.index);
  }
  return (
    <div className="decision-groups">
      {axes.map((axis) => (
        <section key={axis.key}>
          <h3>{axis.title}</h3>
          <div
            className="choice-grid"
            role="radiogroup"
            aria-label={axis.title}
          >
            {[
              ...new Set(
                choices
                  .map((c) => c.parameters?.[axis.key])
                  .filter((v): v is string => !!v),
              ),
            ].map((value) => (
              <button
                key={value}
                role="radio"
                aria-checked={selection[axis.key] === value}
                disabled={busy}
                onClick={() => select(axis.key, value)}
                className={`choice ${selection[axis.key] === value ? "selected" : ""}`}
              >
                <span>
                  <strong>
                    {axis.key === "repair"
                      ? repairNames[value]
                      : storeNames[value]}
                  </strong>
                  {axis.key === "repair" && (
                    <small>{repairDetails[value]}</small>
                  )}
                </span>
                <i className="choice-radio" />
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
