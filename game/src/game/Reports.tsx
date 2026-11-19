import type { seasonReport } from "./engine";
import { currency, tons } from "./catalog";

type Report = ReturnType<typeof seasonReport>;
type History = { level: number; cash?: number; profit?: number }[];

const MONTH_NAMES = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
const pct = (bps: number) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(bps / 100) + " %";

function Line({ label, value, strong = false, hint }: { label: string; value: string; strong?: boolean; hint?: string }) {
  return (
    <div className={`report-line ${strong ? "strong" : ""}`}>
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <b>{value}</b>
    </div>
  );
}

function Chart({ history }: { history: History }) {
  const points = history.filter((h) => h.cash !== undefined);
  if (points.length < 2)
    return <p className="muted">График появится после двух решений.</p>;
  const values = points.flatMap((p) => [p.cash!, p.profit ?? 0]);
  const max = Math.max(...values, 1),
    min = Math.min(...values, 0);
  const W = 600,
    H = 200,
    pad = 24;
  const x = (i: number) => pad + (i * (W - 2 * pad)) / (points.length - 1);
  const y = (v: number) => H - pad - ((v - min) * (H - 2 * pad)) / (max - min || 1);
  const path = (key: "cash" | "profit") =>
    points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p[key] ?? 0).toFixed(1)}`).join(" ");
  return (
    <figure className="report-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Деньги и накопленная прибыль по уровням">
        <line x1={pad} x2={W - pad} y1={y(0)} y2={y(0)} className="zero" />
        <path d={path("cash")} className="cash-line" />
        <path d={path("profit")} className="profit-line" />
        {points.map((p, i) => (
          <g key={p.level}>
            <circle cx={x(i)} cy={y(p.cash!)} r="4" className="cash-dot">
              <title>{`Уровень ${p.level}: деньги ${currency(p.cash!)}`}</title>
            </circle>
            <circle cx={x(i)} cy={y(p.profit ?? 0)} r="4" className="profit-dot">
              <title>{`Уровень ${p.level}: прибыль ${currency(p.profit ?? 0)}`}</title>
            </circle>
          </g>
        ))}
      </svg>
      <figcaption>
        <span className="key cash">Деньги на счёте</span>
        <span className="key profit">Накопленная прибыль</span>
        <small>по уровням 1–{points[points.length - 1].level}</small>
      </figcaption>
    </figure>
  );
}

export default function Reports({ report, history, compact = false }: { report: Report; history?: History; compact?: boolean }) {
  const b = report.balance;
  const assets = b.equipment + b.stock + b.receivables + b.cash;
  const liabilities = b.capital + b.earnings + b.debt + b.payables;
  return (
    <div className={`reports ${compact ? "compact" : ""}`}>
      <section className="report-card">
        <h3>Отчёт о финансовых результатах · сезон {report.season}, январь – {MONTH_NAMES[report.month - 1]}</h3>
        <Line label="Выручка" value={currency(report.revenue)} />
        {report.other > 0 && <Line label="Прочие доходы" value={currency(report.other)} hint="доход от размещения денег" />}
        <Line label="Расходы сезона" value={currency(report.expenses)} hint="себестоимость, зарплата, аренда, амортизация, проценты" />
        <Line label="Прибыль сезона" value={currency(report.profit)} strong />
        <Line label="Рентабельность продаж" value={report.revenue ? pct(report.margin) : "—"} hint="прибыль ÷ выручка" />
        {report.sold > 0 && (
          <div className="unit-compare">
            <div>
              <small>Цена 1 т</small>
              <b>{currency(report.unitPrice)}</b>
            </div>
            <div>
              <small>Затраты на 1 т проданного</small>
              <b>{currency(report.unitCost)}</b>
            </div>
            <div className={report.unitPrice >= report.unitCost ? "ok" : "bad"}>
              <small>Прибыль с 1 т</small>
              <b>{currency(report.unitPrice - report.unitCost)}</b>
            </div>
          </div>
        )}
        <Line label="Убрано / продано" value={`${tons(report.harvested)} / ${tons(report.sold)}`} />
        {report.yieldPerHa > 0 && <Line label="Урожайность" value={`${(report.yieldPerHa / 1000).toLocaleString("ru-RU", { maximumFractionDigits: 2 })} т/га`} />}
      </section>
      {!compact && (
        <section className="report-card">
          <h3>Баланс хозяйства</h3>
          <div className="balance">
            <div>
              <h4>Актив — чем владеешь</h4>
              <Line label="Основные средства" value={currency(b.equipment)} hint="техника за вычетом амортизации" />
              <Line label="Запасы, посевы, авансы" value={currency(b.stock)} />
              <Line label="Долги покупателей" value={currency(b.receivables)} />
              <Line label="Деньги" value={currency(b.cash)} />
              <Line label="Итого" value={currency(assets)} strong />
            </div>
            <div>
              <h4>Пассив — откуда это взялось</h4>
              <Line label="Уставный капитал" value={currency(b.capital)} />
              <Line label="Нераспределённая прибыль" value={currency(b.earnings)} />
              <Line label="Кредиты и помощь" value={currency(b.debt)} />
              <Line label="Кредиторы и просрочка" value={currency(b.payables)} />
              <Line label="Итого" value={currency(liabilities)} strong />
            </div>
          </div>
          <p className="muted">Актив всегда равен пассиву: каждый рубль имущества имеет источник — собственный или заёмный.</p>
        </section>
      )}
      {!compact && history && (
        <section className="report-card">
          <h3>Деньги и прибыль во времени</h3>
          <Chart history={history} />
          <p className="muted">Линии расходятся, когда прибыль заработана, а деньги ещё не получены (или наоборот): это и есть разница между прибылью и денежным потоком.</p>
        </section>
      )}
    </div>
  );
}
