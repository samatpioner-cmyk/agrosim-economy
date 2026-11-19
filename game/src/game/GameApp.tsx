"use client";
import { useEffect, useState } from "react";
import { play, type View } from "./play";
import messages from "../../messages/ru.json";
import { currency, LEVELS, MONTHS, points, SEASONS, tons } from "./catalog";
const LEVEL_MAX = Math.round(100000 / LEVELS.length);
const LEVEL_GOAL = Math.round(LEVEL_MAX * 0.4);
import FarmScene from "./FarmScene";
import DecisionGroups from "./DecisionGroups";
import ChoicePreview from "./ChoicePreview";
import Reports from "./Reports";
import { AUTO_TEXT, LESSONS, THEMES } from "./lessons";
const { openingGame } = messages;
type Welcome = { onboarding: true };
type Tab = "farm" | "reports" | "path" | "progress";
type Difficulty = "light" | "medium" | "advanced";
const DIFFICULTIES: [Difficulty, string, string][] = [
  ["light", "Лайт", "Выбор из вариантов, подсказки и прогноз последствий"],
  ["medium", "Средний", "Сначала сам считаешь показатель, потом выбираешь решение"],
  ["advanced", "Продвинутый", "Считаешь и принимаешь решения цифрами, без подсказок"],
];
const TABS: Tab[] = ["farm", "reports", "path", "progress"];
const icons: Record<string, string> = { farm: "⌂", reports: "▤", path: "⌁", progress: "◇" };
const labels: Record<Tab, string> = {
  farm: "Хозяйство",
  reports: "Отчёты",
  path: "Твой путь",
  progress: "Достижения",
};
/** Типы уровней, где варианты упорядочены по одной оси: для них есть ползунок. */
const SLIDER_TYPES = ["area", "staff", "deposit", "reserve", "borrow", "fertilizer", "fert_prepay", "weather"];
/** Число из поля ввода: пробелы между разрядами и запятая допускаются. */
function parseNumber(text: string) {
  const v = text.replace(/[\s ]/g, "").replace(",", ".").replace("−", "-");
  if (!/^-?\d+(\.\d+)?$/.test(v)) return null;
  return Number(v);
}
function mix(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}
function autoNotes(list: number[]) {
  return list.map((code) => {
    const month = Math.floor(code / 10),
      kind = code % 10;
    return `${MONTHS[(month - 1) % 12]}: ${AUTO_TEXT[kind]}`;
  });
}
function Facts({ facts }: { facts: [string, number, string][] }) {
  return (
    <span className="opening-facts">
      {facts.map(([label, value, unit]) => (
        <span className="opening-fact" key={label}>
          <span>{(openingGame.labels as Record<string, string>)[label] ?? label}</span>
          <b>
            {unit === "money"
              ? currency(value)
              : unit === "kg"
                ? tons(value)
                : unit === "people"
                  ? value + " чел."
                  : value + " га"}
          </b>
        </span>
      ))}
    </span>
  );
}
export default function GameApp() {
  const [data, setData] = useState<View | Welcome | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [tab, setTab] = useState<Tab>("farm"),
    [name, setName] = useState(""),
    [difficulty, setDifficulty] = useState<Difficulty>("light"),
    [calc, setCalc] = useState(""),
    [value, setValue] = useState(""),
    [selected, setSelected] = useState<number | null>(null),
    [confirm, setConfirm] = useState(false),
    [help, setHelp] = useState(false),
    [hint, setHint] = useState(0);
  const game = data && !("onboarding" in data) ? data : null;
  async function request(body?: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const res = play(body);
      if (!res.ok) {
        let message = res.data.error;
        if (res.status === 422) {
          setHelp(true);
          setConfirm(true);
          const details = res.data.help;
          if (details)
            message += ` Новое обязательство: ${currency(details.obligation)}. Просрочка: ${currency(details.arrears)}. Штраф: ${points(details.penalty)} баллов.`;
        }
        throw new Error(message);
      }
      const next = res.data;
      setData(next);
      setSelected(null);
      setConfirm(false);
      setHelp(false);
      setHint(0);
      setCalc("");
      setValue("");
      if (!("practice" in next) || !next.practice) setTab("farm");
      return next;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Не удалось выполнить действие. Попробуй ещё раз.",
      );
      return null;
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void request();
  }, []);
  async function act(action: string, index?: number, allowHelp = false) {
    if (!game) return;
    // Расчёт (средний и продвинутый уровни) и решение числом (продвинутый) идут вместе с выбором.
    const extra =
      action === "choose"
        ? {
            ...(game.task && calcNumber !== null ? { calc: calcNumber } : {}),
            ...(game.numeric && valueNumber !== null ? { value: valueNumber } : {}),
          }
        : {};
    await request({ action, index, allowHelp, ...extra });
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await request({ action: "join", name, difficulty });
  }
  const season = game ? SEASONS[game.level.season - 1] : SEASONS[0];
  const score = game?.score ?? 0;
  const total = game?.total ?? LEVELS.length;
  const progress = game ? Math.round((game.completed.length / total) * 100) : 0;
  const lesson = game ? LESSONS[game.levelNumber - 1] : undefined;
  const picked = game?.choices.find((c) => c.index === selected);
  const level = game?.difficulty ?? "light";
  const open = level === "light";
  const calcNumber = parseNumber(calc);
  const valueNumber = parseNumber(value);
  const valueOk =
    !!game?.numeric &&
    valueNumber !== null &&
    valueNumber >= game.numeric.min &&
    valueNumber <= game.numeric.max;
  const canDecide =
    !busy &&
    (game?.numeric ? valueOk : selected !== null) &&
    (!game?.task || calcNumber !== null);
  // На среднем и продвинутом варианты перемешаны по-своему у каждого студента.
  const ordered = game
    ? open
      ? game.choices
      : [...game.choices].sort(
          (a, b) =>
            mix(`${game.farmId}|${game.levelNumber}|${a.index}`) -
            mix(`${game.farmId}|${game.levelNumber}|${b.index}`),
        )
    : [];
  const factor = open ? 1 : 0.7;
  return (
    <div className="game-shell">
      <header className="topbar">
        <a className="brand" href="./index.html" aria-label="AgroSim — главная">
          <span className="brand-symbol">
            a<span>•</span>
          </span>
          <span>
            agro<span>sim</span>
            <small>экономика в твоих руках</small>
          </span>
        </a>
        {game && (
          <nav className="desktop-nav" aria-label="Разделы игры">
            {TABS.map((t) => (
              <button
                key={t}
                className={tab === t ? "active" : ""}
                onClick={() => setTab(t)}
              >
                {labels[t]}
              </button>
            ))}
          </nav>
        )}
        <span className="edition">
          <i /> учебная игра
        </span>
      </header>
      {!data ? (
        <main className="loading">
          <span className="loader" />
          <h1>Готовим твоё хозяйство</h1>
          {error && (
            <>
              <p role="alert">{error}</p>
              <button className="primary" onClick={() => request()}>
                Попробовать снова
              </button>
            </>
          )}
        </main>
      ) : !game ? (
        <main className="welcome">
          <section className="welcome-copy">
            <span className="eyebrow">
              <i /> ЧЕТЫРЕ СЕЗОНА · ОДНО ХОЗЯЙСТВО
            </span>
            <h1>
              Посей идею.
              <br />
              Вырасти <em>результат.</em>
            </h1>
            <p className="lead">
              Твоя земля, твои решения. Пройди путь от первого посева до
              уверенного управления хозяйством — и узнай, как работает
              экономика.
            </p>
            <div className="welcome-facts">
              <span>16 ключевых решений</span>
              <span>С телефона</span>
              <span>В своём темпе</span>
            </div>
            <form onSubmit={submit} className="entry-card">
              <div className="entry-heading">
                <div>
                  <h2>У каждого хозяйства есть имя</h2>
                  <p>Придумай название и выбери уровень сложности.</p>
                </div>
              </div>
              <label htmlFor="farm-name">Название хозяйства</label>
              <input
                id="farm-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                maxLength={60}
                placeholder="Например, «Зелёная долина»"
                autoFocus
              />
              <fieldset className="difficulty-pick">
                <legend>Уровень сложности</legend>
                {DIFFICULTIES.map(([id, title, text]) => (
                  <label
                    key={id}
                    className={difficulty === id ? "selected" : ""}
                  >
                    <input
                      type="radio"
                      name="difficulty"
                      value={id}
                      checked={difficulty === id}
                      onChange={() => setDifficulty(id)}
                    />
                    <span>
                      <strong>{title}</strong>
                      <small>{text}</small>
                    </span>
                  </label>
                ))}
              </fieldset>
              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}
              <button className="primary wide" disabled={busy}>
                Начать игру →
              </button>
              <small>Прохождение хранится в этой вкладке до её закрытия или перезагрузки.</small>
            </form>
          </section>
          <section className="welcome-art">
            <FarmScene large />
            <div className="floating-card">
              <span>🌾</span>
              <div>
                <small>ТВОЯ ТОЧКА ОТСЧЁТА</small>
                <strong>500 гектаров возможностей</strong>
                <p>Первое решение уже совсем близко</p>
              </div>
            </div>
            <span className="art-caption">
              Маленькие решения. Большая картина.
            </span>
          </section>
        </main>
      ) : (
        <>
          <main className="play-layout">
            <aside className="left-rail">
              <div className="farm-identity">
                <span className="eyebrow">ТВОЁ ХОЗЯЙСТВО</span>
                <h1>{game.farmName}</h1>
              </div>
              <div className="season-card">
                <div className="season-icon">
                  {["🌱", "🌾", "☀", "✦"][game.level.season - 1]}
                </div>
                <span>Сезон {game.level.season} из 4</span>
                <h2>{season.name}</h2>
                <small>{season.role}</small>
                <div className="track">
                  <i style={{ width: `${progress}%` }} />
                </div>
                <p>{game.completed.length} из {total} решений принято</p>
              </div>
              <div className="rail-note">
                <span>✧</span>
                <p>Хозяйство помнит твои решения. Здесь всё связано.</p>
              </div>
              <div className="mode-tag">
                Уровень:{" "}
                {DIFFICULTIES.find(([id]) => id === game.difficulty)?.[1] ??
                  "Лайт"}
              </div>
            </aside>
            <section className="main-play">
              {tab === "farm" ? (
                <>
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">
                        {game.phase === "finished"
                          ? "ИСТОРИЯ ТОЛЬКО НАЧИНАЕТСЯ"
                          : `РЕШЕНИЕ ${game.levelNumber} / ${total}`}
                      </span>
                      <h2>
                        {game.phase === "finished"
                          ? "Ты управляешь результатом"
                          : game.level.title}
                      </h2>
                    </div>
                    <span className="date-badge">
                      {MONTHS[game.level.month - 1]}
                      <b>Сезон {game.level.season}</b>
                    </span>
                  </div>
                  <div className="scene-wrap">
                    <FarmScene
                      state={
                        game.phase === "decision"
                          ? (picked?.preview ?? game.state)
                          : (game.result?.after ?? game.state)
                      }
                      preview={game.phase === "decision" && !!picked && open}
                    />
                    <span className="weather-badge">
                      {game.level.season === 3
                        ? "◌ Сухой сезон"
                        : game.level.season === 4
                          ? "☁ Погода меняется"
                          : "☀ Хороший день для решений"}
                    </span>
                    <span className="live-tag">
                      <i />{" "}
                      {game.practice
                        ? "Тренировка прошлой ситуации"
                        : "Твоё хозяйство живёт"}
                    </span>
                  </div>
                  <div className="mobile-stats">
                    <div>
                      <small>Деньги</small>
                      <b>{currency(game.state.s.cash, true)}</b>
                    </div>
                    <div>
                      <small>На складе</small>
                      <b>{tons(game.state.s.inventory)}</b>
                    </div>
                    <div>
                      <small>Баллы</small>
                      <b>{points(score)}</b>
                    </div>
                  </div>
                  {game.phase === "decision" ? (
                    <section className="decision-panel">
                      <div className="story-heading">
                        <span className="advisor">
                          {game.level.season === 3 ? "Ф" : "А"}
                        </span>
                        <div>
                          <small>
                            {game.level.season === 3
                              ? "Финансовый план"
                              : "Совет хозяйства"}
                          </small>
                          <p>{lesson?.story ?? game.level.mechanic + "."}</p>
                        </div>
                      </div>
                      {game.auto.length > 0 && (
                        <div className="auto-note">
                          <b>Пока ты думал, хозяйство работало по плану</b>
                          <ul>
                            {autoNotes(game.auto).map((t) => (
                              <li key={t}>{t}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div className="mission">
                        <span>ТВОЯ ЦЕЛЬ</span>
                        <p>
                          {game.saleTarget == null
                            ? game.level.goal + "."
                            : game.saleTarget === 0
                              ? openingGame.emptySaleGoal
                              : openingGame.saleGoal.replace(
                                  "{target}",
                                  tons(game.saleTarget),
                                )}
                        </p>
                      </div>
                      {game.task && (
                        <div className="calc-task">
                          <span className="block-title">Сначала посчитай</span>
                          <p>{game.task.question}</p>
                          <label htmlFor="calc-answer">Твой ответ</label>
                          <div className="number-field">
                            <input
                              id="calc-answer"
                              inputMode="decimal"
                              autoComplete="off"
                              value={calc}
                              onChange={(e) => setCalc(e.target.value)}
                              placeholder={game.task.digits ? "Например, 12,5" : "Например, 125000"}
                              disabled={busy}
                              aria-invalid={calc !== "" && calcNumber === null}
                            />
                            <span>{game.task.unit}</span>
                          </div>
                          {calc !== "" && calcNumber === null && (
                            <small className="field-error">
                              Введи только число: цифры, можно с запятой.
                            </small>
                          )}
                          <small>
                            Округли до{" "}
                            {game.task.digits ? `${game.task.digits === 1 ? "десятых" : "сотых"}` : "целого"}.
                            Точный ответ — 30 % баллов уровня, ответ с ошибкой до 5 % — половина.
                          </small>
                        </div>
                      )}
                      {game.numeric ? (
                        <div className="calc-task numeric-decision">
                          <span className="block-title">Твоё решение</span>
                          <label htmlFor="decision-value">{game.numeric.label}</label>
                          <div className="number-field">
                            <input
                              id="decision-value"
                              inputMode="numeric"
                              autoComplete="off"
                              value={value}
                              onChange={(e) => setValue(e.target.value)}
                              disabled={busy}
                              aria-invalid={value !== "" && !valueOk}
                            />
                            <span>{game.numeric.unit}</span>
                          </div>
                          <small className={value !== "" && !valueOk ? "field-error" : ""}>
                            Допустимо от {game.numeric.min.toLocaleString("ru-RU")} до{" "}
                            {game.numeric.max.toLocaleString("ru-RU")} {game.numeric.unit}.
                          </small>
                        </div>
                      ) : null}
                      {!game.numeric && open && SLIDER_TYPES.includes(game.level.type) &&
                        game.choices.length > 1 && (
                          <div className="option-slider">
                            <label htmlFor="option-range">
                              Передвинь ползунок и смотри, как меняется
                              хозяйство
                            </label>
                            <input
                              id="option-range"
                              type="range"
                              min={0}
                              max={game.choices.length - 1}
                              step={1}
                              value={selected ?? 0}
                              onChange={(e) =>
                                setSelected(Number(e.target.value))
                              }
                              disabled={busy}
                            />
                            <div className="slider-ticks">
                              {game.choices.map((c) => (
                                <span
                                  key={c.index}
                                  className={
                                    selected === c.index ? "active" : ""
                                  }
                                >
                                  {c.title}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      {game.numeric ? null : game.level.type === "repair_harvest" ? (
                        <DecisionGroups
                          key={`${game.levelNumber}-${game.version}`}
                          choices={game.choices}
                          busy={busy}
                          onSelect={setSelected}
                        />
                      ) : (
                        <div
                          className={`choice-grid ${game.choices.length > 4 ? "many-choices" : ""}`}
                          role="radiogroup"
                          aria-label="Выбери хозяйственное решение"
                        >
                          {ordered.map((c, i) => (
                            <button
                              role="radio"
                              aria-checked={selected === c.index}
                              className={`choice ${selected === c.index ? "selected" : ""}`}
                              key={i}
                              onClick={() => setSelected(c.index)}
                              disabled={busy}
                            >
                              <span className="choice-number">
                                {String(i + 1).padStart(2, "0")}
                              </span>
                              <span>
                                <strong>{c.title}</strong>
                                {c.facts.length > 0 ? (
                                  <>
                                    {c.detail && <small>{c.detail}</small>}
                                    <Facts
                                      facts={c.facts.filter(
                                        ([label]) =>
                                          label !== "rented" && label !== "cash",
                                      )}
                                    />
                                  </>
                                ) : (
                                  <small>{c.detail}</small>
                                )}
                              </span>
                              <i className="choice-radio" />
                            </button>
                          ))}
                        </div>
                      )}
                      {picked && open && (
                        <ChoicePreview
                          before={game.state}
                          after={picked.preview}
                          title={picked.title}
                        />
                      )}
                      {hint > 0 && lesson && (
                        <div className="hint">
                          <b>{hint === 1 ? "Подумай так" : "Формула в помощь"}</b>
                          {hint === 1 ? (
                            <p>{lesson.tip}</p>
                          ) : (
                            lesson.formula.map((f) => (
                              <p className="formula" key={f}>
                                {f}
                              </p>
                            ))
                          )}
                        </div>
                      )}
                      <div className="decision-footer">
                        {level === "advanced" ? (
                          <span className="muted">
                            Продвинутый уровень: без подсказок
                          </span>
                        ) : (
                          <button
                            className="text-button"
                            disabled={busy || (level === "medium" && hint >= 1)}
                            onClick={() =>
                              setHint((v) => Math.min(open ? 2 : 1, v + 1))
                            }
                          >
                            ☼{" "}
                            {hint === 0
                              ? "Подсказка"
                              : hint === 1 && open
                                ? "Ещё подсказка: формула"
                                : "Подсказки открыты"}
                          </button>
                        )}
                        <button
                          className="primary"
                          disabled={!canDecide}
                          onClick={() => setConfirm(true)}
                        >
                          Принять решение <span>→</span>
                        </button>
                      </div>
                    </section>
                  ) : game.phase === "result" && game.result ? (
                    <section className="result-panel">
                      <div
                        className="star-row"
                        aria-label={`${game.result.stars} из 3 звёзд`}
                      >
                        {[0, 1, 2].map((s) => (
                          <span
                            className={s < game.result!.stars ? "earned" : ""}
                            key={s}
                          >
                            ★
                          </span>
                        ))}
                      </div>
                      <span className="eyebrow">
                        {game.practice
                          ? "ТРЕНИРОВКА — ОСНОВНОЕ ХОЗЯЙСТВО НЕ МЕНЯЕТСЯ"
                          : "РЕШЕНИЕ СОХРАНЕНО"}
                      </span>
                      <h2>
                        {game.result.components.goal === Math.round(LEVEL_GOAL * factor)
                          ? openingGame.metGoal
                          : game.result.components.goal > 0
                            ? openingGame.partialGoal
                            : openingGame.missedGoal}
                      </h2>
                      <section
                        className="opening-review"
                        aria-label={openingGame.resultLabel}
                      >
                        <span className="block-title">Что произошло</span>
                        <Facts facts={game.result.facts} />
                        {game.auto.length > 0 && (
                          <ul className="auto-list">
                            {autoNotes(game.auto).map((t) => (
                              <li key={t}>{t}</li>
                            ))}
                          </ul>
                        )}
                        {game.result.components.safety === 0 && (
                          <p className="opening-warning">
                            {openingGame.reserveWarning}
                          </p>
                        )}
                      </section>
                      {game.result.calc && (
                        <section
                          className={`calc-review ${game.result.calc.score === 1 ? "ok" : game.result.calc.score > 0 ? "close" : "wrong"}`}
                        >
                          <span className="block-title">Твой расчёт</span>
                          <p>{game.result.calc.question}</p>
                          <div className="calc-compare">
                            <span>
                              Ты ответил:{" "}
                              <b>
                                {game.result.calc.given.toLocaleString("ru-RU")}{" "}
                                {game.result.calc.unit}
                              </b>
                            </span>
                            <span>
                              Верно:{" "}
                              <b>
                                {game.result.calc.answer.toLocaleString("ru-RU")}{" "}
                                {game.result.calc.unit}
                              </b>
                            </span>
                          </div>
                          <strong>
                            {game.result.calc.score === 1
                              ? "✓ Расчёт верный"
                              : game.result.calc.score > 0
                                ? "≈ Почти: ошибка меньше 5 %, засчитана половина"
                                : "✗ Расчёт неверный"}
                          </strong>
                          <p className="formula">{game.result.calc.formula}</p>
                        </section>
                      )}
                      {lesson && (
                        <section className="why-card">
                          <div className="why-head">
                            <span className="block-title">Почему так</span>
                            <span className="theme-badge">
                              {THEMES[lesson.theme]}
                            </span>
                          </div>
                          <h3>{lesson.term}</h3>
                          <div className="formulas">
                            {lesson.formula.map((f) => (
                              <p className="formula" key={f}>
                                {f}
                              </p>
                            ))}
                          </div>
                          <p>{lesson.why}</p>
                        </section>
                      )}
                      {game.review.length > 1 && (
                        <section className="review-card">
                          <span className="block-title">
                            Разбор всех вариантов
                          </span>
                          <div className="review-list">
                            {[...game.review]
                              .sort((x, y) => y.points - x.points)
                              .map((r, i, list) => (
                                <div
                                  key={r.index}
                                  className={`review-row ${r.chosen ? "chosen" : ""} ${r.points === list[0].points ? "best" : ""}`}
                                >
                                  <div>
                                    <strong>
                                      {r.title}
                                      {r.chosen && <em>твой выбор</em>}
                                      {r.points === list[0].points && (
                                        <em className="best-tag">лучший</em>
                                      )}
                                    </strong>
                                    <Facts
                                      facts={r.facts
                                        .filter(([l]) => l !== "rented")
                                        .slice(0, 3)}
                                    />
                                  </div>
                                  <b>
                                    {points(r.points)}
                                    <small>
                                      {"★".repeat(r.stars) || "—"}
                                    </small>
                                  </b>
                                </div>
                              ))}
                          </div>
                        </section>
                      )}
                      {game.seasonEnd && (
                        <section className="season-summary">
                          <span className="block-title">
                            Итоги сезона {game.level.season}: январь –{" "}
                            {MONTHS[game.level.month - 1].toLowerCase()}
                          </span>
                          {game.level.month < 12 && (
                            <p className="muted">
                              До конца года хозяйство ещё платит зарплату и
                              накладные расходы, поэтому годовая прибыль будет
                              ниже.
                            </p>
                          )}
                          <Reports report={game.report} compact />
                        </section>
                      )}
                      <div className="reward">
                        <strong>
                          +{points(game.result.points)} <small>балла</small>
                        </strong>
                        <span>+{game.practice ? 0 : game.result.xp} опыта</span>
                      </div>
                      <div className="consequences">
                        <div>
                          <small>Изменение денег</small>
                          <b>
                            {currency(
                              game.result.after.s.cash -
                                game.result.before.s.cash,
                            )}
                          </b>
                        </div>
                        <div>
                          <small>Изменение накопленной прибыли</small>
                          <b>
                            {currency(
                              game.result.after.s.earnings -
                                game.result.before.s.earnings,
                            )}
                          </b>
                        </div>
                        {game.result.after.s.receivables.length > 0 && (
                          <div>
                            <small>Покупатели заплатят позже</small>
                            <b>
                              {currency(
                                game.result.after.s.receivables.reduce(
                                  (v, r) => v + r[1],
                                  0,
                                ),
                              )}
                            </b>
                          </div>
                        )}
                      </div>
                      <div className="rubric">
                        {(
                          [
                            ["goal", "Цель", LEVEL_MAX * 0.4 * factor],
                            ["efficiency", "Эффективность", LEVEL_MAX * 0.4 * factor],
                            ["safety", "Безопасность", LEVEL_MAX * 0.2 * factor],
                            ...(game.result.calc
                              ? ([["calc", "Расчёт", LEVEL_MAX * 0.3]] as const)
                              : []),
                          ] as const
                        ).map(([k, label, max]) => (
                          <div key={k}>
                            <span>{label}</span>
                            <i>
                              <b
                                style={{
                                  width: `${Math.min(100, ((game.result!.components[k] ?? 0) / max) * 100)}%`,
                                }}
                              />
                            </i>
                            <strong>
                              {points(game.result!.components[k] ?? 0)}
                            </strong>
                          </div>
                        ))}
                      </div>
                      {game.result.components.penalty > 0 && (
                        <p className="error">
                          Помощь и просрочка: −
                          {points(game.result.components.penalty)} баллов.
                        </p>
                      )}
                      <div className="result-actions">
                        {game.practice ? (
                          <button className="primary" onClick={() => request()}>
                            Вернуться в своё хозяйство →
                          </button>
                        ) : (
                          <>
                            <button
                              className="primary"
                              disabled={busy}
                              onClick={() => act("continue")}
                            >
                              {game.levelNumber === total
                                ? "Завершить четыре сезона"
                                : "Следующее решение"}{" "}
                              →
                            </button>
                            {game.mode === "learning" && open && (
                              <button
                                className="text-button"
                                disabled={busy}
                                onClick={() => act("repeat")}
                              >
                                Попробовать иначе
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </section>
                  ) : (
                    <section className="finish">
                      <span>✦</span>
                      <h2>Четыре сезона. Твоя история.</h2>
                      <p>
                        Ты принял {total} ключевых решений и провёл хозяйство
                        через четыре сезона. Посмотри отчёты: каким оно стало.
                      </p>
                      <strong>
                        {points(game.score)} <small>из 1000 баллов</small>
                      </strong>
                      <p>
                        {game.stars} звёзд · {game.xp} опыта
                      </p>
                      <button
                        className="primary"
                        onClick={() => setTab("reports")}
                      >
                        Открыть отчёты хозяйства →
                      </button>
                    </section>
                  )}
                </>
              ) : tab === "reports" ? (
                <>
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">ЦИФРЫ ТВОЕГО ХОЗЯЙСТВА</span>
                      <h2>Отчёты</h2>
                    </div>
                  </div>
                  <Reports report={game.report} history={game.completed} />
                </>
              ) : tab === "path" ? (
                <>
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">ОДНО РЕШЕНИЕ ЗА ДРУГИМ</span>
                      <h2>Твой путь</h2>
                    </div>
                    <span className="pill">{progress} %</span>
                  </div>
                  <div className="path-list">
                    {SEASONS.map((s, i) => (
                      <section key={s.name}>
                        <div className="chapter-title">
                          <span>0{i + 1}</span>
                          <div>
                            <small>{s.role}</small>
                            <h3>{s.name}</h3>
                          </div>
                        </div>
                        {LEVELS.filter((l) => l.season === i + 1).map((l) => {
                          const result = game.completed.find(
                              (c) => c.level === l.id,
                            ),
                            current = l.id === game.levelNumber;
                          return (
                            <button
                              key={l.id}
                              className={`path-level ${current ? "current" : ""} ${result ? "done" : ""}`}
                              disabled={!current || game.phase === "finished" || busy}
                              onClick={() => setTab("farm")}
                            >
                              <span className="path-number">
                                {result ? "✓" : l.id}
                              </span>
                              <span>
                                <strong>{l.title}</strong>
                                <small>
                                  {result
                                    ? `${points(result.points)} балла`
                                    : current
                                      ? "Твоё следующее решение"
                                      : "Откроется по ходу истории"}
                                </small>
                              </span>
                              <b>
                                {result
                                  ? "★".repeat(result.stars)
                                  : current
                                    ? "→"
                                    : "·"}
                              </b>
                            </button>
                          );
                        })}
                      </section>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">
                        РАСТЁТ ХОЗЯЙСТВО — РАСТЁШЬ ТЫ
                      </span>
                      <h2>Твои достижения</h2>
                    </div>
                  </div>
                  <section className="progress-hero">
                    <span>✧</span>
                    <h3>{season.role}</h3>
                    <p>{game.farmName}</p>
                    <strong>
                      {points(score)}
                      <small> / 1000 баллов</small>
                    </strong>
                    <div className="track">
                      <i style={{ width: `${score / 1000}%` }} />
                    </div>
                    <div className="progress-facts">
                      <span>
                        <b>{game.stars}</b> звёзд из {total * 3}
                      </span>
                      <span>
                        <b>{game.xp}</b> опыта
                      </span>
                      <span>
                        <b>{game.completed.length}</b> решений
                      </span>
                    </div>
                  </section>
                  <div className="achievements">
                    {[
                      ["🌱", "Первый посев", 2],
                      ["🌾", "Первый урожай", 3],
                      ["↗", "Первая выручка", 4],
                      ["⚙", "Системный подход", 8],
                      ["◇", "Деньги во времени", 12],
                      ["✦", "Управляющий", 16],
                    ].map(([icon, label, level]) => (
                      <article
                        className={
                          game.completed.length >= Number(level)
                            ? "unlocked"
                            : "locked"
                        }
                        key={String(label)}
                      >
                        <span>{icon}</span>
                        <h3>{label}</h3>
                        <p>
                          {game.completed.length >= Number(level)
                            ? "Этот шаг уже в твоей истории"
                            : `После уровня ${level}`}
                        </p>
                      </article>
                    ))}
                  </div>
                </>
              )}
              {error && (
                <div className="error-banner" role="alert">
                  <p>{error}</p>
                  {!confirm && (
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => request()}
                    >
                      Повторить запрос
                    </button>
                  )}
                </div>
              )}
            </section>
            <aside className="right-rail">
              <span className="eyebrow">ПУЛЬС ХОЗЯЙСТВА</span>
              <div className="stat-card money-card">
                <span>↗</span>
                <small>Денежные средства</small>
                <strong>{currency(game.state.s.cash, true)}</strong>
                <p>Доступны для твоих решений</p>
              </div>
              <div className="stat-card">
                <span>▤</span>
                <small>Урожай на складе</small>
                <strong>{tons(game.state.s.inventory)}</strong>
                <p>Вместимость {tons(1000000 + game.state.storage_extra)}</p>
              </div>
              <div className="stat-card">
                <span>◇</span>
                <small>Твой результат</small>
                <strong>
                  {points(score)} <i>/ 1000</i>
                </strong>
                <p>
                  {game.xp} опыта · {game.stars} звёзд
                </p>
              </div>
              {game.state.s.debt > 0 && (
                <div className="stat-card">
                  <small>Основной долг</small>
                  <strong>{currency(game.state.s.debt, true)}</strong>
                  <p>Проценты — отдельный расход</p>
                </div>
              )}
              <div className="learning-note">
                <span>НА ПРАКТИКЕ</span>
                <p>{lesson?.term ?? game.level.concept}</p>
                {lesson && <i>{THEMES[lesson.theme]}</i>}
              </div>
            </aside>
          </main>
          <nav className="mobile-nav" aria-label="Разделы игры">
            {TABS.map((t) => (
              <button
                className={tab === t ? "active" : ""}
                key={t}
                onClick={() => setTab(t)}
              >
                <span>{icons[t]}</span>
                {labels[t]}
              </button>
            ))}
          </nav>
          {confirm && (
            <div className="modal-backdrop">
              <section
                className="confirm-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="confirm-title"
              >
                <span className="eyebrow">
                  {help ? "ВОССТАНОВЛЕНИЕ" : "ТВОЁ РЕШЕНИЕ"}
                </span>
                <h2 id="confirm-title">
                  {help ? "Продолжить с помощью?" : "Подтвердить план?"}
                </h2>
                <p>
                  {help
                    ? error
                    : game.numeric && valueNumber !== null
                      ? `${valueNumber.toLocaleString("ru-RU")} ${game.numeric.unit}`
                      : game.choices.find((c) => c.index === selected)?.title}
                  {!help && game.task && calcNumber !== null && (
                    <>
                      <br />
                      Твой расчёт: {calcNumber.toLocaleString("ru-RU")} {game.task.unit}
                    </>
                  )}
                </p>
                {!help && error && (
                  <p role="alert" className="error">
                    {error}
                  </p>
                )}
                <p>
                  {help
                    ? "Обязательство и штраф сохранятся в хозяйстве."
                    : !open
                      ? "Решение и расчёт сохраняются один раз, повторить уровень нельзя. Проверь цифры."
                      : "Результат изменит хозяйство. В обучении можно повторить текущую ситуацию."}
                </p>
                <button
                  className="primary wide"
                  disabled={busy}
                  onClick={() => act("choose", selected ?? 0, help)}
                >
                  {busy
                    ? "Рассчитываем последствия…"
                    : help
                      ? "Принять обязательство и продолжить"
                      : "Выполнить решение →"}
                </button>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => {
                    setConfirm(false);
                    setHelp(false);
                    setError("");
                  }}
                >
                  Вернуться к выбору
                </button>
              </section>
            </div>
          )}
        </>
      )}
      <footer className="game-footer">
        <span>agrosim</span>
        <p>Знания, которые приносят плоды.</p>
        <small>Экономика предприятия · учебная симуляция</small>
        {game && (
          <button className="switch-player text-button" onClick={() => {
            if (window.confirm("Начать новое прохождение? Текущий результат будет сброшен.")) {
              void request({ action: "reset" });
            }
          }}>
            Начать заново
          </button>
        )}
      </footer>
    </div>
  );
}
