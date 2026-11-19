import economy from "./economy.json" with { type: "json" };
import campaign from "./campaign.json" with { type: "json" };
import { safe } from "../simulation/finance";
import type { openingGame } from "../../messages/ru.json";

export const VERSION = "campaign-0.4";
/** Максимум сотых балла за уровень: 1000 баллов на всю кампанию. */
export const LEVEL_MAX = Math.round(100000 / campaign.levels.length);
const W_GOAL = LEVEL_MAX * 0.4,
  W_EFF = LEVEL_MAX * 0.4,
  W_SAFE = LEVEL_MAX * 0.2;
export const LEVELS = campaign.levels;
export type Level = (typeof LEVELS)[number];
export type Option = Record<string, string | number | boolean>;
type Receipt = [number, number];
export interface Ledger {
  cash: number;
  equipment: number;
  capital: number;
  debt: number;
  assistance: number;
  arrears: number;
  earnings: number;
  inventory: number;
  inventory_value: number;
  wip: number;
  receivables: Receipt[];
  extra_assets: number;
  trade_payables: number;
  help_used: number;
  help_episodes: number;
  penalties: number;
  revenue: number;
  interest: number;
  harvested: number;
  depreciation_basis: number;
  staff: number;
  min_cash: number;
  max_debt: number;
  max_arrears: number;
  months: number;
}
export interface GameState {
  s: Ledger;
  month: number;
  area: number;
  crop_area: number;
  seed_bps: number;
  fertilizer: string;
  fertilized: boolean;
  harvested: boolean;
  harvest_potential: number;
  seed_credit_ha: number;
  seed_credit_value: number;
  fert_credit_ha: number;
  fert_credit_value: number;
  rent_credit_ha: number;
  rent_credit_value: number;
  harvest_credit_ha: number;
  harvest_credit_value: number;
  deposit: number;
  deposit_income: number;
  salary: number;
  bonus: number;
  lease: boolean;
  efficiency: boolean;
  weather_recovery: number;
  capacity_bps: number;
  storage_extra: number;
  freight_price: number;
  scheduled: { month: number; price: number }[];
  payables: Receipt[];
  procurement: string;
  input_budget: number;
  earmarked: number;
  planned_credit: boolean;
  interest_basis: number;
  final_order_kg: number;
  last_penalty: number;
  /** Автоматические работы: месяц*10 + код (1 посев, 2 удобрения, 3 уборка). */
  auto: number[];
  /** Продано зерна за всю игру, кг. */
  sold?: number;
  /** Прочие доходы (проценты по размещению), коп. */
  other_income?: number;
  season_start?: { revenue: number; earnings: number; interest: number; sold: number; harvested: number; other?: number };
  /** Индивидуальные условия студента: цена (p) и погода (w) по сезонам, б.п. Нет — базовые условия. */
  v?: Variant;
}
export interface Variant {
  p: number[];
  w: number[];
}
export interface Evaluation {
  option: Option;
  state: GameState;
  points: number;
  stars: number;
  xp: number;
  metrics: {
    goal: number;
    utility: number;
    safety: number;
    liquidity_margin: number;
  };
  components: {
    goal: number;
    efficiency: number;
    safety: number;
    penalty: number;
  };
}
const e = economy.economy,
  r = campaign.rules,
  h = economy.help;
const C = (rub: number) => Math.round(rub * 100);
const round = (v: number) => Math.floor(v + 0.5);
const md = (a: number, b: number, denominator = 10000) => {
  if (
    ![a, b, denominator].every(Number.isSafeInteger) ||
    a < 0 ||
    b < 0 ||
    denominator <= 0
  )
    throw new Error("Недопустимое значение расчёта.");
  return safe(
    Number(
      (BigInt(a) * BigInt(b) + BigInt(denominator) / 2n) / BigInt(denominator),
    ),
  );
};
function at<T>(object: Record<string, T>, key: unknown): T {
  const value = object[String(key)];
  if (value === undefined) throw new Error("Недоступный вариант решения.");
  return value;
}
const sum = (list: Receipt[]) => list.reduce((a, [, v]) => a + v, 0);
const year = (g: GameState) => Math.floor((g.month - 1) / 12) + 1;
const mon = (g: GameState) => ((g.month - 1) % 12) + 1;
const clone = <T>(v: T): T => structuredClone(v);
export function initialState(): GameState {
  return {
    s: {
      cash: C(economy.initial.cash),
      equipment: C(economy.initial.equipment_value),
      capital: C(economy.initial.cash + economy.initial.equipment_value),
      debt: 0,
      assistance: 0,
      arrears: 0,
      earnings: 0,
      inventory: 0,
      inventory_value: 0,
      wip: 0,
      receivables: [],
      extra_assets: 0,
      trade_payables: 0,
      help_used: 0,
      help_episodes: 0,
      penalties: 0,
      revenue: 0,
      interest: 0,
      harvested: 0,
      depreciation_basis: C(economy.initial.equipment_value),
      staff: 12,
      min_cash: C(economy.initial.cash),
      max_debt: 0,
      max_arrears: 0,
      months: 0,
    },
    month: 0,
    area: 0,
    crop_area: 0,
    seed_bps: 10000,
    fertilizer: "standard",
    fertilized: false,
    harvested: false,
    harvest_potential: 0,
    seed_credit_ha: 0,
    seed_credit_value: 0,
    fert_credit_ha: 0,
    fert_credit_value: 0,
    rent_credit_ha: 0,
    rent_credit_value: 0,
    harvest_credit_ha: 0,
    harvest_credit_value: 0,
    deposit: 0,
    deposit_income: 0,
    salary: 30000,
    bonus: 0,
    lease: false,
    efficiency: false,
    weather_recovery: 0,
    capacity_bps: 10000,
    storage_extra: 0,
    freight_price: 50,
    scheduled: [],
    payables: [],
    procurement: "normal",
    input_budget: 0,
    earmarked: 0,
    planned_credit: false,
    interest_basis: 0,
    final_order_kg: 200000,
    last_penalty: 0,
    auto: [],
  };
}
export function invariant(g: GameState) {
  const s = g.s;
  const assets =
    s.cash +
    s.equipment +
    s.inventory_value +
    s.wip +
    s.extra_assets +
    sum(s.receivables);
  const liabilities = s.debt + s.assistance + s.arrears + s.trade_payables;
  if (assets !== liabilities + s.capital + s.earnings)
    throw new Error("Не удалось проверить баланс хозяйства.");
  const amounts = [
    s.cash,
    s.equipment,
    s.inventory,
    s.inventory_value,
    s.wip,
    s.extra_assets,
    s.debt,
    s.assistance,
    s.arrears,
    s.trade_payables,
  ];
  if (
    amounts.some((x) => !Number.isSafeInteger(x) || x < 0) ||
    (!s.inventory && s.inventory_value)
  )
    throw new Error("Нарушено ограничение ресурсов.");
  s.min_cash = Math.min(s.min_cash, s.cash);
  s.max_debt = Math.max(s.max_debt, s.debt + s.assistance);
  s.max_arrears = Math.max(s.max_arrears, s.arrears);
}
function pay(g: GameState, amount: number) {
  const s = g.s;
  const missing = Math.max(0, amount - s.cash);
  const help = Math.min(missing, Math.max(0, C(h.annual_limit) - s.help_used));
  if (help) {
    const fee = md(help, h.service_fee_bps);
    s.cash += help;
    s.assistance += help + fee;
    s.help_used += help;
    s.earnings -= fee;
    s.help_episodes++;
    s.penalties += h.score_penalty_hundredths_per_episode;
  }
  const paid = Math.min(s.cash, amount);
  s.cash -= paid;
  s.arrears += amount - paid;
}
function cost(
  g: GameState,
  amount: number,
  production = false,
  equipmentPurchase = false,
) {
  pay(g, amount);
  if (production) g.s.wip += amount;
  else if (equipmentPurchase) {
    g.s.equipment += amount;
    g.s.depreciation_basis += amount;
  } else g.s.earnings -= amount;
  invariant(g);
}
type Credit = "seed_credit" | "fert_credit" | "rent_credit" | "harvest_credit";
function prepay(g: GameState, key: Credit, ha: number, value: number) {
  pay(g, value);
  g.s.extra_assets += value;
  g[`${key}_ha`] += ha;
  g[`${key}_value`] += value;
  invariant(g);
}
function consume(g: GameState, key: Credit, ha: number) {
  const qty = g[`${key}_ha`],
    used = Math.min(qty, ha),
    value = qty ? md(g[`${key}_value`], used, qty) : 0;
  g[`${key}_ha`] -= used;
  g[`${key}_value`] -= value;
  g.s.extra_assets -= value;
  g.s.wip += value;
  return ha - used;
}
function rent(g: GameState) {
  cost(
    g,
    consume(g, "rent_credit", g.area) * C(e.rent_per_active_ha_year),
    true,
  );
}
const seasonIndex = (g: GameState) =>
  Math.min(economy.seasons.length, Math.max(1, year(g))) - 1;
const seasonPrice = (g: GameState) =>
  g.v?.p[seasonIndex(g)] ?? economy.seasons[seasonIndex(g)].price_bps;
const seasonWeather = (g: GameState) =>
  g.v?.w[seasonIndex(g)] ?? economy.seasons[seasonIndex(g)].weather_bps;
/** Индивидуальные условия: цена ±10 %, погода ±8 % к базовой по каждому сезону. */
export function makeVariant(seed: string): Variant {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const next = () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    p: economy.seasons.map((x) => Math.round(x.price_bps * (0.9 + 0.2 * next()))),
    w: economy.seasons.map((x) => Math.round(x.weather_bps * (0.92 + 0.16 * next()))),
  };
}
function price(g: GameState, m = mon(g)) {
  return md(
    md(C(e.normal_sale_price_per_kg), seasonPrice(g)),
    at(economy.month_price_bps, String(m)),
  );
}
function sell(
  g: GameState,
  qty: number,
  deferred = false,
  premium = e.deferred_price_premium_bps,
  delay = 1,
  p = price(g),
) {
  const s = g.s;
  if (!qty) return 0;
  if (qty < 0 || qty > s.inventory)
    throw new Error("На складе недостаточно пшеницы.");
  const value = md(s.inventory_value, qty, s.inventory);
  let revenue = qty * p;
  if (deferred) {
    revenue = md(revenue, 10000 + premium);
    s.receivables.push([g.month + delay, revenue]);
  } else s.cash += revenue;
  s.inventory -= qty;
  s.inventory_value -= value;
  g.sold = (g.sold ?? 0) + qty;
  s.earnings += revenue - value;
  s.revenue += revenue;
  cost(g, qty * g.freight_price);
  g.freight_price = C(e.delivery_per_kg);
  invariant(g);
  return revenue;
}
function openMonth(g: GameState) {
  const s = g.s,
    m = mon(g);
  g.interest_basis = s.debt;
  if (m === 1) {
    g.season_start = {
      revenue: s.revenue,
      earnings: s.earnings,
      interest: s.interest,
      sold: g.sold ?? 0,
      harvested: s.harvested,
      other: g.other_income ?? 0,
    };
    s.help_used = 0;
    g.crop_area = 0;
    g.seed_bps = 10000;
    g.fertilized = false;
    g.harvested = false;
    g.fertilizer = "standard";
    g.salary = 30000;
    g.bonus = 0;
    g.weather_recovery = 0;
    g.capacity_bps = 10000;
    g.storage_extra = 0;
    g.procurement = "normal";
    g.input_budget = 0;
    if (year(g) > 1) rent(g); // аренда каждого следующего сезона списывается в январе (с учётом предоплаты)
    if (g.lease) cost(g, C(r.efficiency_lease_per_year));
  }
  if (g.deposit && g.month >= r.deposit_due_absolute_month) {
    s.cash += g.deposit + g.deposit_income;
    s.extra_assets -= g.deposit;
    s.earnings += g.deposit_income;
    g.other_income = (g.other_income ?? 0) + g.deposit_income;
    g.deposit = 0;
    g.deposit_income = 0;
  }
  s.cash += sum(s.receivables.filter(([d]) => d <= g.month));
  s.receivables = s.receivables.filter(([d]) => d > g.month);
  for (const receipt of [...g.payables])
    if (receipt[0] <= g.month) {
      pay(g, receipt[1]);
      s.trade_payables -= receipt[1];
      g.payables = g.payables.filter((x) => x !== receipt);
    }
  cost(g, s.staff * C(g.salary) + C(e.overhead_per_month));
  if (m === 8 && g.bonus) {
    cost(g, g.bonus);
    g.bonus = 0;
  }
  const dep = Math.min(
    s.equipment,
    md(s.depreciation_basis, e.annual_depreciation_bps, 120000),
  );
  s.equipment -= dep;
  s.earnings -= dep;
  if (s.inventory) {
    cost(g, s.inventory * C(e.storage_per_kg_month));
    const lost = md(s.inventory, e.storage_loss_bps_month),
      v = md(s.inventory_value, lost, s.inventory);
    s.inventory -= lost;
    s.inventory_value -= v;
    s.earnings -= v;
  }
  for (const order of [...g.scheduled])
    if (order.month === g.month) {
      sell(g, s.inventory, false, 0, 1, order.price);
      g.scheduled = g.scheduled.filter((x) => x !== order);
    }
  invariant(g);
}
/** Автопилот: если в сезоне нет уровня для рутинной работы, хозяйство выполняет её по стандартному плану. */
function autopilot(g: GameState) {
  const m = mon(g),
    sowMonth = year(g) === 2 ? 5 : 4;
  if (m === sowMonth && g.area && !g.crop_area) {
    sow(g, g.area, "standard", true);
    g.auto.push(g.month * 10 + 1);
  }
  if (m === 7 && g.crop_area && !g.fertilized) {
    cost(g, g.crop_area * C(at(e.fertilizer_cost_per_ha, g.fertilizer)), true);
    g.fertilized = true;
    g.auto.push(g.month * 10 + 2);
  }
  if (m === 8 && g.crop_area && !g.harvested) {
    const potential = expectedYield(g, undefined, undefined, undefined, true),
      free = economy.initial.storage_kg - g.s.inventory,
      storage =
        potential <= free ? "own" : potential <= free + 250000 ? "lease250" : "lease500";
    harvest(g, storage);
    g.auto.push(g.month * 10 + 3);
  }
}
function closeMonth(g: GameState) {
  autopilot(g);
  const interest = md(g.interest_basis, r.bank_credit_bps, 120000);
  g.s.interest += interest;
  cost(g, interest);
  if (g.s.arrears) g.s.penalties += h.arrears_penalty_hundredths_per_month;
  g.s.months++;
  invariant(g);
}
export function enterLevel(carry: GameState, l: Level) {
  const g = clone(carry);
  g.auto ??= [];
  const
    target = (l.season - 1) * 12 + l.month;
  while (g.month < target) {
    g.month++;
    openMonth(g);
    if (g.month < target) closeMonth(g);
  }
  return g;
}
function expectedYield(
  g: GameState,
  area = g.crop_area,
  fert = g.fertilizer,
  seed = g.seed_bps,
  actual = false,
) {
  let qty = md(
    md(area * e.base_yield_kg_per_ha, seed),
    at(e.fertilizer_yield_bps, fert),
  );
  if (actual)
    qty = md(
      md(
        qty,
        Math.min(
          11000,
          seasonWeather(g) + g.weather_recovery,
        ),
      ),
      g.capacity_bps,
    );
  return qty;
}
function sowCost(g: GameState, area: number, seed: string) {
  const p = at(r.seed_options, seed).cost_per_ha,
    credit = seed === "standard" ? Math.min(area, g.seed_credit_ha) : 0,
    field =
      e.field_work_per_ha -
      (g.efficiency ? e.efficiency_upgrade_saving_per_ha : 0);
  return C((area - credit) * p + area * field);
}
function sow(g: GameState, area: number, seed: string, bundle: boolean) {
  area = Math.min(
    area,
    g.s.staff * e.employee_capacity_ha,
    economy.initial.tractors * e.tractor_capacity_ha,
  );
  const p = at(r.seed_options, seed),
    missing = seed === "standard" ? consume(g, "seed_credit", area) : area,
    field =
      e.field_work_per_ha -
      (g.efficiency ? e.efficiency_upgrade_saving_per_ha : 0);
  cost(g, C(missing * p.cost_per_ha + area * field), true);
  g.crop_area = area;
  g.seed_bps = p.yield_bps;
  if (bundle) {
    cost(
      g,
      C(
        consume(g, "fert_credit", area) *
          at(e.fertilizer_cost_per_ha, g.fertilizer),
      ),
      true,
    );
    g.fertilized = true;
  }
}
function harvest(g: GameState, storage: string) {
  const potential = expectedYield(g, undefined, undefined, undefined, true),
    space = at(r.temporary_storage, storage);
  g.harvest_potential = potential;
  cost(g, C(space.fee), true);
  cost(
    g,
    consume(g, "harvest_credit", g.crop_area) * C(e.harvest_per_ha),
    true,
  );
  g.storage_extra = space.extra_kg;
  const kept = Math.max(
      0,
      Math.min(
        potential,
        economy.initial.storage_kg + g.storage_extra - g.s.inventory,
      ),
    ),
    v = potential ? md(g.s.wip, kept, potential) : 0;
  g.s.inventory += kept;
  g.s.inventory_value += v;
  g.s.earnings -= g.s.wip - v;
  g.s.wip = 0;
  g.s.harvested += kept;
  g.harvested = true;
  invariant(g);
  return [kept, potential];
}
function firstSaleTarget(stock: number) {
  return Math.min(r.minimum_trade_kg, Math.floor(stock / 2));
}

type OpeningFact = [
  label: keyof typeof openingGame.labels,
  value: number,
  unit: "money" | "kg" | "ha" | "people",
];

/** Ключевые цифры решения для карточки варианта и разбора: зависят от типа уровня. */
export function openingFacts(
  level: number,
  before: GameState,
  after: GameState,
): OpeningFact[] {
  const l = LEVELS[level - 1];
  if (!l) return [];
  const b = before.s,
    a = after.s,
    wip = a.wip - b.wip,
    receivable = sum(a.receivables) - sum(b.receivables),
    cash: OpeningFact = ["cash", a.cash, "money"];
  const forecast = (g: GameState) =>
    expectedYield(g, g.crop_area || g.area, undefined, undefined, true);
  switch (l.type) {
    case "area":
      return [["rented", after.area, "ha"], ["rent", wip, "money"], cash];
    case "sow":
    case "sow_bundle": {
      const qty = expectedYield(after);
      return [
        ["sown", after.crop_area, "ha"],
        ["sowing", wip, "money"],
        ["forecast", qty, "kg"],
        ["unitCost", qty ? Math.round((a.wip * 1000) / qty) : 0, "money"],
      ];
    }
    case "fertilizer":
      return [["fertilizer", wip, "money"], ["forecast", expectedYield(after), "kg"], cash];
    case "harvest":
    case "repair_harvest": {
      const kept = a.harvested - b.harvested;
      const keptWithoutRent = Math.max(
        0,
        Math.min(after.harvest_potential, economy.initial.storage_kg - b.inventory),
      );
      const storage = Object.values(r.temporary_storage).find(
        (option) => option.extra_kg === after.storage_extra,
      );
      const fee = C(storage?.fee ?? 0);
      const facts: OpeningFact[] = [
        ["stored", kept, "kg"],
        ["lost", after.harvest_potential - kept, "kg"],
        ["storage", fee, "money"],
      ];
      if (fee)
        facts.push(["storageValue", (kept - keptWithoutRent) * price(after, 9) - fee, "money"]);
      if (l.type === "repair_harvest") facts.push(cash);
      return facts;
    }
    case "first_sale":
    case "last_sale":
    case "sale_terms":
    case "sale_plan":
    case "final": {
      const facts: OpeningFact[] = [
        ["sold", b.inventory - a.inventory, "kg"],
        ["revenue", a.revenue - b.revenue, "money"],
      ];
      if (receivable > 0) facts.push(["receivable", receivable, "money"]);
      const scheduled = after.scheduled.length > before.scheduled.length;
      if (a.inventory) facts.push([scheduled ? "contracted" : "remaining", a.inventory, "kg"]);
      if (l.type === "final") facts.push(["debt", a.debt + a.assistance + a.arrears, "money"]);
      facts.push(cash);
      return facts;
    }
    case "transport":
      return [["cash", a.cash, "money"]];
    case "fert_prepay": {
      const qty = forecast(after);
      return [
        ["fertilizer", a.extra_assets - b.extra_assets, "money"],
        ["forecast", qty, "kg"],
        cash,
      ];
    }
    case "staff":
      return [
        ["staff", a.staff, "people"],
        ["capacity", a.staff * e.employee_capacity_ha, "ha"],
        ["payroll", a.staff * C(after.salary), "money"],
        cash,
      ];
    case "equipment": {
      const saving = after.efficiency ? after.area * C(e.efficiency_upgrade_saving_per_ha) : 0;
      return [
        ["investment", Math.max(0, b.cash - a.cash), "money"],
        ["saving", saving, "money"],
        cash,
      ];
    }
    case "deposit":
      return [
        ["deposit", after.deposit, "money"],
        ["depositIncome", after.deposit_income, "money"],
        cash,
      ];
    case "borrow":
      return [
        ["debt", a.debt, "money"],
        ["interestYear", md(a.debt, r.bank_credit_bps), "money"],
        cash,
      ];
    case "repay_safe":
    case "repay_close": {
      const facts: OpeningFact[] = [["debt", a.debt + a.assistance + a.arrears, "money"]];
      if (a.extra_assets > b.extra_assets)
        facts.push(["prepaid", a.extra_assets - b.extra_assets, "money"]);
      facts.push(cash);
      return facts;
    }
    case "reserve":
      return [["reserve", after.earmarked, "money"], cash];
    case "weather":
      return [["protection", wip, "money"], ["forecast", forecast(after), "kg"], cash];
    case "factor":
      return [["receivable", sum(a.receivables), "money"], cash];
    default:
      return [cash];
  }
}

/** Сводка сезона для отчётов: с начала текущего года. */
export function seasonReport(g: GameState) {
  const s = g.s,
    start = g.season_start ?? { revenue: 0, earnings: 0, interest: 0, sold: 0, harvested: 0 };
  const revenue = s.revenue - start.revenue,
    profit = s.earnings - start.earnings,
    sold = (g.sold ?? 0) - start.sold,
    other = (g.other_income ?? 0) - (start.other ?? 0),
    expenses = revenue + other - profit;
  return {
    season: Math.max(1, year(g)),
    month: mon(g),
    revenue,
    other,
    expenses,
    profit,
    interest: s.interest - start.interest,
    harvested: s.harvested - start.harvested,
    sold,
    /** Полная себестоимость 1 т проданного зерна, коп. */
    unitCost: sold ? Math.round((expenses * 1000) / sold) : 0,
    /** Средняя цена 1 т, коп. */
    unitPrice: sold ? Math.round((revenue * 1000) / sold) : 0,
    /** Рентабельность продаж, б.п. */
    margin: revenue ? Math.round((profit * 10000) / revenue) : 0,
    yieldPerHa: g.crop_area ? Math.round((s.harvested - start.harvested) / g.crop_area) : 0,
    balance: {
      equipment: s.equipment,
      stock: s.inventory_value + s.wip + s.extra_assets,
      receivables: sum(s.receivables),
      cash: s.cash,
      capital: s.capital,
      earnings: s.earnings,
      debt: s.debt + s.assistance,
      payables: s.arrears + s.trade_payables,
    },
  };
}

export function openingSaleTarget(level: number, state: GameState) {
  return LEVELS[level - 1]?.type === "first_sale" ? firstSaleTarget(state.s.inventory) : undefined;
}

function forecastLow(g: GameState, loan = 0, offer = false) {
  let balance = g.s.cash + loan;
  if (offer) balance += Math.max(0, C(r.bank_credit_limit) - g.s.debt);
  let low = balance;
  const now = mon(g),
    end = !g.harvested && now < 8 ? 8 : Math.min(12, now + 1),
    start = (year(g) - 1) * 12;
  for (let m = now + 1; m <= end; m++) {
    const ix = start + m;
    balance += sum(g.s.receivables.filter(([d]) => d === ix));
    balance -= sum(g.payables.filter(([d]) => d === ix));
    if (g.deposit && ix === r.deposit_due_absolute_month)
      balance += g.deposit + g.deposit_income;
    balance -= g.s.staff * C(g.salary) + C(e.overhead_per_month);
    if (m === 8) balance -= g.bonus;
    const sowMonth = year(g) === 2 ? 5 : 4;
    if (!g.crop_area && m === sowMonth)
      balance -= sowCost(g, g.area, "standard");
    if (!g.fertilized && m === (year(g) === 1 ? 7 : sowMonth))
      balance -=
        Math.max(0, g.area - g.fert_credit_ha) *
        C(at(e.fertilizer_cost_per_ha, g.fertilizer));
    if (m === 8 && !g.harvested) {
      const expected = expectedYield(g, g.crop_area || g.area),
        extra = Math.max(0, expected - economy.initial.storage_kg),
        storage = extra === 0 ? 0 : extra <= 250000 ? 50000 : 100000;
      balance -=
        Math.max(0, (g.crop_area || g.area) - g.harvest_credit_ha) *
          C(e.harvest_per_ha) +
        C(storage);
    }
    balance -= md(g.s.debt + loan, r.bank_credit_bps, 120000);
    low = Math.min(low, balance);
  }
  return low;
}
function neededLoan(g: GameState) {
  for (let a = 0; a <= C(r.bank_credit_limit) - g.s.debt; a += C(100000))
    if (forecastLow(g, a) >= C(r.reserve_rub)) return a;
  return Math.max(0, C(r.bank_credit_limit) - g.s.debt);
}
function options(g: GameState, l: Level): Option[] {
  const t = l.type;
  if (t === "area") return [300, 400, 500].map((area) => ({ area }));
  if (t === "sow" || t === "sow_bundle")
    return [...new Set([Math.max(0, g.area - 100), g.area])].flatMap((area) =>
      ["economy", "standard", "premium"].map((seed) => ({ area, seed })),
    );
  if (t === "fertilizer" || t === "fert_prepay")
    return ["low", "standard", "high"].map((fertilizer) => ({ fertilizer }));
  if (t === "harvest")
    return Object.keys(r.temporary_storage).flatMap((storage) =>
      [false].map(
        (repay_on_return) => ({ storage, repay_on_return }),
      ),
    );
  if (t === "first_sale")
    return [2500, 5000, 7500, 10000].map((fraction) => ({ fraction }));
  if (t === "transport")
    return Object.keys(r.transport).map((transport) => ({ transport }));
  if (t === "sale_terms")
    return [false, true].map((deferred) => ({ deferred }));
  if (t === "seed_prepay" || t === "rent_prepay")
    return [0, 5000, 10000].map((fraction) => ({ fraction }));
  if (t === "staff") return [8, 10, 12, 16].map((staff) => ({ staff }));
  if (t === "wages")
    return Object.keys(r.wage_schemes).map((wages) => ({ wages }));
  if (t === "equipment")
    return ["none", "buy", "lease"].map((equipment) => ({ equipment }));
  if (t === "sale_plan")
    return ["now", "split", "forward"].map((plan) => ({ plan }));
  if (t === "deposit")
    return r.deposit_options
      .filter((a) => C(a) <= Math.max(0, g.s.cash - g.s.debt - g.s.assistance))
      .map((a) => ({ deposit: C(a) }));
  if (t === "procurement")
    return ["normal", "prepay", "installment"].map((procurement) => ({
      procurement,
    }));
  if (t === "borrow")
    return [
      ...new Set([
        0,
        neededLoan(g),
        Math.max(0, C(r.bank_credit_limit) - g.s.debt),
      ]),
    ]
      .sort((a, b) => a - b)
      .map((borrow) => ({ borrow }));
  if (t === "repay_safe" || t === "repay_close") {
    const total = g.s.debt + g.s.assistance + g.s.arrears;
    if (!total)
      return t === "repay_safe"
        ? [false, true].map((prepay_harvest) => ({ repay: 0, prepay_harvest }))
        : [0, 5000, 10000].map((rent_fraction) => ({
            repay: 0,
            rent_fraction,
          }));
    const maximum = Math.min(total, g.s.cash),
      safe = Math.min(maximum, Math.max(0, forecastLow(g) - C(r.reserve_rub)));
    return [...new Set([0, safe, maximum])]
      .sort((a, b) => a - b)
      .map((repay) => ({ repay }));
  }
  if (t === "reserve")
    return [1000000, 1800000, 3000000].map((a) => ({ reserve: C(a) }));
  if (t === "weather")
    return Object.keys(r.weather_options).map((weather) => ({ weather }));
  if (t === "repair_harvest")
    return Object.keys(r.repair_options).flatMap((repair) =>
      Object.keys(r.temporary_storage).map((storage) => ({ repair, storage })),
    );
  if (t === "last_sale")
    return [2500, 5000, 7500, 10000].flatMap((fraction) =>
      [false, true].map((deferred) => ({ fraction, deferred })),
    );
  if (t === "factor") return [false, true].map((factor) => ({ factor }));
  if (t === "final")
    return ["cash", "store_half", "discount"].map((final) => ({ final }));
  throw new Error("Уровень недоступен.");
}
function apply(g: GameState, l: Level, o: Option) {
  const t = l.type,
    s = g.s;
  let goal = 1,
    utility = 0;
  const help = s.help_episodes,
    arrears = s.arrears;
  if (t === "area") {
    g.area = Number(o.area);
    rent(g);
    goal = Math.min(1, g.area / (economy.initial.land_ha * 0.8));
    utility = g.area * (e.base_yield_kg_per_ha * C(10.5) - C(10500));
  } else if (t === "sow" || t === "sow_bundle") {
    const before = s.wip;
    sow(g, Number(o.area), String(o.seed), t === "sow_bundle");
    goal = Math.min(
      1,
      g.crop_area / Math.max(1, g.area * 0.95),
      g.seed_bps / 9500,
    );
    utility = expectedYield(g) * C(10.5) - (s.wip - before);
  } else if (t === "fertilizer") {
    g.fertilizer = String(o.fertilizer);
    const amount = g.crop_area * C(at(e.fertilizer_cost_per_ha, g.fertilizer));
    cost(g, amount, true);
    g.fertilized = true;
    goal = Math.min(1, at(e.fertilizer_yield_bps, g.fertilizer) / 9500);
    utility = expectedYield(g) * C(10.5) - amount;
  } else if (t === "harvest" || t === "repair_harvest") {
    let extra = 0;
    if (t === "repair_harvest") {
      const repair = at(r.repair_options, o.repair);
      extra = C(repair.cost);
      cost(g, extra, true);
      g.capacity_bps = repair.capacity_bps;
    }
    const [kept, potential] = harvest(g, String(o.storage));
    const full = g.capacity_bps ? md(potential, 10000, g.capacity_bps) : 0;
    goal = Math.min(1, kept / Math.max(1, full * 0.95));
    utility =
      kept * C(10.5) - C(at(r.temporary_storage, o.storage).fee) - extra;
    if (o.repay_on_return) {
      const repaid = Math.min(s.debt, Math.max(0, s.cash - C(r.reserve_rub)));
      s.cash -= repaid;
      s.debt -= repaid;
      utility += md(repaid, r.bank_credit_bps * 4, 120000);
    }
  } else if (t === "first_sale" || t === "last_sale") {
    const stock = s.inventory,
      qty = md(stock, Number(o.fraction)),
      deferred = Boolean(o.deferred);
    const earned = sell(
      g,
      qty,
      deferred,
      t === "last_sale" ? r.season4_deferred_premium_bps : 0,
      deferred && t === "last_sale" ? 3 : 1,
    );
    const target =
      t === "last_sale" ? g.final_order_kg : firstSaleTarget(stock);
    goal = stock
      ? Math.min(
          1,
          qty / Math.max(1, target),
          s.inventory / Math.max(1, target),
        )
      : 0;
    const months = t === "last_sale" ? 3 : 2,
      remainingPrice = price(g, t === "last_sale" ? 12 : 11),
      remaining = md(s.inventory, 10000 - e.storage_loss_bps_month * months);
    utility =
      earned -
      qty * C(e.delivery_per_kg) +
      remaining * (remainingPrice - C(e.delivery_per_kg)) -
      s.inventory * C(e.storage_per_kg_month) * months;
  } else if (t === "transport") {
    const offer = at(r.transport, o.transport);
    cost(g, C(offer.fee));
    g.freight_price = C(offer.price_per_kg);
    utility = -C(offer.fee) - s.inventory * g.freight_price;
  } else if (t === "sale_terms") {
    const qty = s.inventory,
      freight = g.freight_price,
      earned = sell(g, qty, Boolean(o.deferred), e.deferred_price_premium_bps);
    goal = qty ? 1 : 0;
    utility = earned - qty * freight - (o.deferred ? md(earned, 100) : 0);
  } else if (t === "seed_prepay" || t === "rent_prepay") {
    const qty = md(g.area, Number(o.fraction)),
      seed = t === "seed_prepay",
      p = C(seed ? e.seed_per_ha : e.rent_per_active_ha_year),
      discount = seed ? r.seed_prepay_discount_bps : r.rent_prepay_discount_bps,
      value = md(qty * p, 10000 - discount);
    prepay(g, seed ? "seed_credit" : "rent_credit", qty, value);
    goal = Math.min(1, qty / Math.max(1, g.area / 2));
    utility = qty * p - value - md(value, 100);
  } else if (t === "fert_prepay") {
    g.fertilizer = String(o.fertilizer);
    const value = md(
      g.area * C(at(e.fertilizer_cost_per_ha, g.fertilizer)),
      10000 - r.fertilizer_prepay_discount_bps,
    );
    prepay(g, "fert_credit", g.area, value);
    goal = Math.min(1, at(e.fertilizer_yield_bps, g.fertilizer) / 9500);
    utility = expectedYield(g, g.area) * C(10.5) - value;
  } else if (t === "staff") {
    const target = Number(o.staff),
      severance =
        Math.max(0, s.staff - target) * C(e.salary_per_employee_month);
    cost(g, severance);
    s.staff = target;
    goal = Math.min(1, (target * e.employee_capacity_ha) / Math.max(1, g.area));
    utility = -target * C(30000) * 10 - severance;
  } else if (t === "wages") {
    const offer = at(r.wage_schemes, o.wages);
    g.salary = offer.salary;
    g.bonus = s.staff * C(offer.bonus);
    utility = -s.staff * C(g.salary) * 9 - g.bonus;
  } else if (t === "equipment") {
    const years = 5 - year(g);
    if (o.equipment === "buy") {
      const purchase = C(e.efficiency_upgrade_price);
      cost(g, purchase, false, true);
      g.efficiency = true;
      const residual =
        purchase -
        md(purchase, e.annual_depreciation_bps * (48 - g.month), 120000);
      utility =
        years * g.area * C(e.efficiency_upgrade_saving_per_ha) +
        residual -
        purchase;
    } else if (o.equipment === "lease") {
      cost(g, C(r.efficiency_lease_per_year));
      g.efficiency = true;
      g.lease = true;
      utility =
        years *
        (g.area * C(e.efficiency_upgrade_saving_per_ha) -
          C(r.efficiency_lease_per_year));
    }
  } else if (t === "sale_plan") {
    const qty = md(
        s.inventory,
        at({ now: 10000, split: 5000, forward: 0 }, o.plan),
      ),
      earned = sell(g, qty),
      p = price(g, 11);
    if (s.inventory)
      g.scheduled.push({ month: (year(g) - 1) * 12 + 11, price: p });
    const future = md(s.inventory, 10000 - e.storage_loss_bps_month);
    utility =
      earned -
      qty * C(e.delivery_per_kg) +
      future * (p - C(e.delivery_per_kg)) -
      s.inventory * C(e.storage_per_kg_month);
  } else if (t === "deposit") {
    const amount = Number(o.deposit);
    s.cash -= amount;
    s.extra_assets += amount;
    g.deposit = amount;
    g.deposit_income = md(amount, r.deposit_return_bps);
    g.planned_credit = true;
    const anticipated = Math.max(0, C(r.reserve_rub) - forecastLow(g));
    utility = g.deposit_income - md(anticipated, r.bank_credit_bps * 6, 120000);
  } else if (t === "procurement") {
    g.procurement = String(o.procurement);
    const seed = g.area * C(e.seed_per_ha);
    if (g.procurement === "prepay") {
      const value = md(seed, 10000 - r.supplier_seed_prepay_discount_bps);
      prepay(g, "seed_credit", g.area, value);
      utility = seed - value - md(value, 100);
    } else if (g.procurement === "installment") {
      const fee = md(seed, r.supplier_installment_fee_bps);
      s.extra_assets += seed;
      g.seed_credit_ha += g.area;
      g.seed_credit_value += seed;
      s.trade_payables += seed + fee;
      g.payables.push([(year(g) - 1) * 12 + 6, seed + fee]);
      s.earnings -= fee;
      utility = -fee;
    }
    g.input_budget =
      sowCost(g, g.area, "standard") +
      g.seed_credit_value +
      g.fert_credit_value +
      Math.max(0, g.area - g.fert_credit_ha) *
        C(at(e.fertilizer_cost_per_ha, g.fertilizer));
  } else if (t === "borrow") {
    const amount = Number(o.borrow);
    s.cash += amount;
    s.debt += amount;
    g.interest_basis += amount;
    g.planned_credit = false;
    goal = forecastLow(g) >= C(r.reserve_rub) ? 1 : 0;
    utility = -md(amount, r.bank_credit_bps * 6, 120000);
  } else if (t === "repay_safe" || t === "repay_close") {
    const value = Number(o.repay);
    s.cash -= value;
    let left = value;
    for (const key of ["arrears", "assistance", "debt"] as const) {
      const take = Math.min(left, s[key]);
      s[key] -= take;
      left -= take;
    }
    utility = md(
      value,
      r.bank_credit_bps * (t === "repay_safe" ? 1 : 3),
      120000,
    );
    if (o.prepay_harvest) {
      const regular = g.crop_area * C(e.harvest_per_ha),
        paid = md(regular, 9500);
      prepay(g, "harvest_credit", g.crop_area, paid);
      utility = regular - paid - md(paid, 100);
    }
    if (o.rent_fraction !== undefined) {
      const qty = md(g.area, Number(o.rent_fraction)),
        regular = qty * C(e.rent_per_active_ha_year),
        paid = md(regular, 10000 - r.rent_prepay_discount_bps);
      prepay(g, "rent_credit", qty, paid);
      utility = regular - paid - md(paid, 100);
    }
  } else if (t === "reserve") {
    g.earmarked = Number(o.reserve);
    const stress =
      (s.staff * C(g.salary) + C(e.overhead_per_month)) * 3 +
      g.area * C(600) +
      C(400000);
    goal = Math.min(1, g.earmarked / Math.max(1, stress));
    if (g.earmarked > s.cash) goal = 0;
    utility = -md(g.earmarked, 200);
    g.input_budget =
      sowCost(g, g.area, "standard") +
      g.area * C(at(e.fertilizer_cost_per_ha, g.fertilizer));
  } else if (t === "weather") {
    const offer = at(r.weather_options, o.weather),
      old = expectedYield(g, undefined, undefined, undefined, true),
      amount = g.crop_area * C(offer.cost_per_ha);
    cost(g, amount, true);
    g.weather_recovery = offer.recovery_bps;
    utility =
      (expectedYield(g, undefined, undefined, undefined, true) - old) *
        (C(10.5) - C(e.delivery_per_kg)) -
      amount;
    goal = utility >= 0 ? 1 : 0;
  } else if (t === "factor") {
    const value = sum(s.receivables.filter(([due]) => due > g.month));
    if (o.factor && value) {
      const fee = md(value, r.factoring_fee_bps);
      s.cash += value - fee;
      s.receivables = [];
      s.earnings -= fee;
      utility = -fee;
    }
    g.earmarked = Math.max(g.earmarked, C(r.reserve_rub));
  } else if (t === "final") {
    const qty =
        o.final === "store_half" ? Math.floor(s.inventory / 2) : s.inventory,
      p = o.final === "discount" ? md(price(g), 8000) : price(g);
    sell(g, qty, false, e.deferred_price_premium_bps, 1, p);
    const reserve = Math.max(g.earmarked, C(r.reserve_rub)),
      repay = Math.min(
        s.debt + s.assistance + s.arrears,
        Math.max(0, s.cash - reserve),
      );
    s.cash -= repay;
    let left = repay;
    for (const key of ["arrears", "assistance", "debt"] as const) {
      const take = Math.min(left, s[key]);
      s[key] -= take;
      left -= take;
    }
    goal = Math.min(1, qty / Math.max(1, g.final_order_kg));
    if (s.earnings <= 0 || s.arrears || s.cash < reserve) goal = 0;
    utility =
      s.capital +
      s.earnings -
      s.inventory_value +
      md(s.inventory * price(g), r.terminal_inventory_value_bps);
  } else throw new Error("Уровень недоступен.");
  closeMonth(g);
  invariant(g);
  const offer = g.planned_credit && (t === "deposit" || t === "procurement"),
    margin = forecastLow(g, 0, offer) - C(r.reserve_rub);
  const safety =
    margin >= 0 &&
    s.help_episodes === help &&
    s.arrears <= arrears &&
    !s.arrears
      ? 1
      : 0;
  if (
    [
      "transport",
      "wages",
      "equipment",
      "sale_plan",
      "deposit",
      "procurement",
      "repay_safe",
      "repay_close",
      "factor",
    ].includes(t)
  )
    goal = Math.min(goal, safety);
  return {
    goal: Math.max(0, Math.min(1, goal)),
    utility,
    safety,
    liquidity_margin: margin,
  };
}
export function evaluate(
  carry: GameState,
  levelNumber: number,
  custom?: number,
): { entry: GameState; choices: Evaluation[] } {
  const l = LEVELS[levelNumber - 1];
  if (!l) throw new Error("Уровень недоступен.");
  const entry = enterLevel(carry, l);
  const list = options(entry, l);
  // Продвинутый уровень: значение студента оценивается вместе со стандартными вариантами.
  if (custom !== undefined) list.push(customOption(entry, l, custom));
  const rows = list.map((option) => {
    const state = clone(entry),
      metrics = apply(state, l, option);
    return { option, state, metrics };
  });
  const eligible = rows.filter(
      (x) => x.metrics.goal >= 1 && x.metrics.safety === 1,
    ),
    reference = Math.max(
      ...(eligible.length ? eligible : rows).map((x) => x.metrics.utility),
    );
  const choices = rows.map((row) => {
    const m = row.metrics,
      regret = Math.max(0, reference - m.utility),
      eff =
        regret <= C(l.tolerance)
          ? 1
          : Math.max(0, 1 - (regret - C(l.tolerance)) / C(l.loss_scale));
    const goal = round(m.goal * W_GOAL),
      efficiency = round(eff * W_EFF),
      safety = m.safety * W_SAFE,
      penalty = Math.max(0, row.state.s.penalties - carry.last_penalty),
      points = Math.max(0, goal + efficiency + safety - penalty);
    row.state.last_penalty = row.state.s.penalties;
    let stars = 0;
    if (m.goal >= 1 && points >= W_GOAL)
      stars =
        points >= LEVEL_MAX * 0.95 && m.safety ? 3 : points >= LEVEL_MAX * 0.7 ? 2 : 1;
    return {
      ...row,
      points,
      stars,
      xp: md(points, 100, LEVEL_MAX),
      components: { goal, efficiency, safety, penalty },
    };
  });
  return { entry, choices };
}
export function choose(
  carry: GameState,
  level: number,
  index: number,
  allowHelp = false,
  custom?: number,
): Evaluation {
  const rows = evaluate(carry, level, custom).choices;
  const row = custom !== undefined ? rows[rows.length - 1] : rows[index];
  if (!row) throw new Error("Выбери доступное решение.");
  if (
    !allowHelp &&
    (row.state.s.help_episodes > carry.s.help_episodes ||
      row.state.s.arrears > carry.s.arrears)
  )
    throw new Error("HELP_REQUIRED");
  return row;
}

/* ===== Уровни сложности: решения цифрами и задачи на расчёт ===== */

/** Число по-русски: разряды через пробел, дробная часть через запятую. */
export function ru(x: number, digits = 0) {
  const sign = x < 0 ? "−" : "",
    [int, frac] = Math.abs(x).toFixed(digits).split(".");
  return sign + int.replace(/\B(?=(\d{3})+(?!\d))/g, " ") + (frac ? "," + frac : "");
}
const NUMERIC: Record<string, { key: string; unit: string; label: string; step: number; money?: boolean }> = {
  area: { key: "area", unit: "га", label: "Сколько гектаров арендовать?", step: 1 },
  staff: { key: "staff", unit: "чел.", label: "Сколько работников оставить в штате?", step: 1 },
  deposit: { key: "deposit", unit: "₽", label: "Какую сумму разместить на депозите?", step: 1000, money: true },
  borrow: { key: "borrow", unit: "₽", label: "Какую сумму взять в кредит?", step: 1000, money: true },
  repay_close: { key: "repay", unit: "₽", label: "Какую сумму долга погасить сейчас?", step: 1000, money: true },
  reserve: { key: "reserve", unit: "₽", label: "Какой резерв на риски отложить?", step: 1000, money: true },
};
/** Для продвинутого уровня: решение вводится числом (или null, если уровень решается выбором). */
export function numericDecision(entry: GameState, levelNumber: number) {
  const l = LEVELS[levelNumber - 1],
    n = l && NUMERIC[l.type];
  if (!n) return null;
  const s = entry.s,
    rub = (v: number) => Math.max(0, Math.floor(v / 100));
  let min = 0,
    max = 0;
  if (l.type === "area") max = economy.initial.land_ha;
  else if (l.type === "staff") {
    min = 4;
    max = 20;
  } else if (l.type === "deposit") max = rub(s.cash - s.debt - s.assistance);
  else if (l.type === "borrow") max = rub(C(r.bank_credit_limit) - s.debt);
  else if (l.type === "repay_close") {
    const total = s.debt + s.assistance + s.arrears;
    if (!total) return null;
    max = rub(Math.min(total, s.cash));
  } else if (l.type === "reserve") max = rub(s.cash);
  return { label: n.label, unit: n.unit, min, max, step: n.step };
}
function customOption(entry: GameState, l: Level, value: number): Option {
  const range = numericDecision(entry, l.id);
  if (!range || !Number.isFinite(value))
    throw new Error("Это решение принимается выбором варианта.");
  if (value < range.min || value > range.max)
    throw new Error(`Введи число от ${ru(range.min)} до ${ru(range.max)} ${range.unit}.`);
  const n = NUMERIC[l.type],
    v = n.money ? C(Math.round(value)) : Math.round(value);
  return { [n.key]: v };
}

export interface CalcTask {
  question: string;
  unit: string;
  formula: string;
  answer: number;
  digits: number;
}
/** Задача на расчёт для среднего и продвинутого уровней: данные берутся из условий студента. */
export function calcTask(entry: GameState, levelNumber: number): CalcTask {
  const s = entry.s,
    pt = Math.round(price(entry) * 10), // ₽ за тонну
    area = entry.area || economy.initial.land_ha,
    crop = entry.crop_area || area,
    t = (kg: number, d = 1) => Number((kg / 1000).toFixed(d)),
    task = (question: string, unit: string, formula: string, answer: number, digits = 0): CalcTask => ({
      question,
      unit,
      formula,
      answer: Number(answer.toFixed(digits)),
      digits,
    });
  const field = e.field_work_per_ha - (entry.efficiency ? e.efficiency_upgrade_saving_per_ha : 0);
  const harvestT = t(expectedYield(entry, crop, undefined, undefined, true));
  const protect = r.weather_options.standard.cost_per_ha;
  switch (levelNumber) {
    case 1:
      return task(
        `Урожайность 2,4 т/га, цена зерна ${ru(pt)} ₽/т, прямые затраты на 1 га — 10 500 ₽. Каков маржинальный доход с 1 га?`,
        "₽",
        "Маржинальный доход = Урожайность × Цена − Прямые затраты на 1 га",
        2.4 * pt - 10500,
      );
    case 2:
      return task(
        `Посев ${ru(area)} га стандартными семенами: семена ${ru(r.seed_options.standard.cost_per_ha)} ₽/га, полевые работы ${ru(field)} ₽/га. Сколько стоит посев?`,
        "₽",
        "Стоимость посева = Площадь × (Семена + Полевые работы на 1 га)",
        area * (r.seed_options.standard.cost_per_ha + field),
      );
    case 3: {
      const perHa = Number((harvestT / crop).toFixed(2)),
        free = t(economy.initial.storage_kg - s.inventory, 0);
      return task(
        `Убираем ${ru(crop)} га, ожидаемая урожайность ${ru(perHa, 2)} т/га, свободно на складе ${ru(free)} т. Сколько тонн не поместится на складе? Если всё поместится, введи 0.`,
        "т",
        "Излишек = Площадь × Урожайность − Свободная вместимость склада",
        Math.max(0, crop * perHa - free),
        1,
      );
    }
    case 4: {
      const q = t(s.inventory);
      return task(
        `На складе ${ru(q, 1)} т зерна, цена ${ru(pt)} ₽/т. Покупатель платит через месяц, но на 3 % дороже. Какой будет выручка при продаже всего зерна с отсрочкой?`,
        "₽",
        "Выручка = Количество × Цена × (1 + Надбавка)",
        q * pt * 1.03,
      );
    }
    case 5: {
      const fixed = (s.staff * e.salary_per_employee_month + e.overhead_per_month) * 12;
      return task(
        `Площадь ${ru(area)} га, переменные затраты 10 500 ₽ на 1 га, постоянные расходы за год ${ru(fixed)} ₽, урожайность 2,4 т/га. Какова себестоимость 1 т зерна?`,
        "₽/т",
        "Себестоимость 1 т = (Переменные затраты + Постоянные расходы) ÷ Объём производства",
        (area * 10500 + fixed) / (area * 2.4),
      );
    }
    case 6:
      return task(
        `В штате ${ru(s.staff)} работников, оклад ${ru(e.salary_per_employee_month)} ₽ в месяц. Каков годовой фонд оплаты труда?`,
        "₽",
        "ФОТ = Численность × Оклад × 12 месяцев",
        s.staff * e.salary_per_employee_month * 12,
      );
    case 7:
      return task(
        `Новая техника стоит ${ru(e.efficiency_upgrade_price)} ₽ и экономит ${ru(e.efficiency_upgrade_saving_per_ha)} ₽ на 1 га. Площадь ${ru(area)} га. За сколько лет окупится покупка?`,
        "лет",
        "Срок окупаемости = Инвестиции ÷ Годовая экономия",
        e.efficiency_upgrade_price / (e.efficiency_upgrade_saving_per_ha * area),
        2,
      );
    case 8: {
      const next = Math.round(price(entry, Math.min(12, mon(entry) + 1)) * 10);
      return task(
        `Цена сейчас ${ru(pt)} ₽/т, через месяц ожидается ${ru(next)} ₽/т. Хранение стоит 100 ₽/т в месяц. Сколько дополнительно заработаешь на каждой тонне, если подождёшь месяц?`,
        "₽/т",
        "Выгода ожидания = Цена через месяц − Цена сейчас − Хранение",
        next - pt - 100,
      );
    }
    case 9: {
      const allowed = r.deposit_options.filter((a) => a > 0 && C(a) <= s.cash - s.debt - s.assistance),
        d = allowed.length ? allowed[allowed.length - 1] : 8000000;
      return task(
        `Депозит ${ru(d)} ₽ на срок до посева, доход за весь срок — ${ru(r.deposit_return_bps / 100)} % от суммы. Сколько составит доход?`,
        "₽",
        "Доход = Сумма депозита × Ставка за срок",
        (d * r.deposit_return_bps) / 10000,
      );
    }
    case 10: {
      const k = Math.max(1000000, Math.round(neededLoan(entry) / 100));
      return task(
        `Кредит ${ru(k)} ₽ под ${ru(r.bank_credit_bps / 100)} % годовых на 6 месяцев. Сколько придётся заплатить процентов?`,
        "₽",
        "Проценты = Сумма кредита × Годовая ставка × Срок (мес.) ÷ 12",
        (k * r.bank_credit_bps * 6) / 10000 / 12,
      );
    }
    case 11: {
      const q = t(s.inventory);
      return task(
        `На складе ${ru(q, 1)} т, цена ${ru(pt)} ₽/т. Половину зерна отгружаешь с отсрочкой оплаты на месяц и надбавкой 3 %. Какая дебиторская задолженность появится?`,
        "₽",
        "Дебиторская задолженность = Отгружено в долг × Цена × (1 + Надбавка)",
        (q / 2) * pt * 1.03,
      );
    }
    case 12: {
      const total = Math.round((s.debt + s.assistance + s.arrears) / 100),
        cash = Math.floor(s.cash / 100);
      if (!total)
        return task(
          `Аренда ${ru(area)} га стоит ${ru(e.rent_per_active_ha_year)} ₽/га в год. За полную предоплату — скидка ${ru(r.rent_prepay_discount_bps / 100)} %. Сколько заплатишь при полной предоплате?`,
          "₽",
          "Платёж = Площадь × Ставка аренды × (1 − Скидка)",
          area * e.rent_per_active_ha_year * (1 - r.rent_prepay_discount_bps / 10000),
        );
      return task(
        `На счёте ${ru(cash)} ₽, долг ${ru(total)} ₽, обязательный резерв ${ru(r.reserve_rub)} ₽. Какую наибольшую сумму долга можно погасить, сохранив резерв?`,
        "₽",
        "Погашение = меньшее из (Долг; Деньги − Резерв)",
        Math.max(0, Math.min(total, cash - r.reserve_rub)),
      );
    }
    case 13:
      return task(
        `Зарплата ${ru(s.staff)} чел. по ${ru(entry.salary)} ₽ и накладные ${ru(e.overhead_per_month)} ₽ в месяц — на 3 месяца, плюс защита посевов ${ru(protect)} ₽/га на ${ru(area)} га и ремонт ${ru(e.tractor_repair)} ₽. Сколько нужно отложить в резерв?`,
        "₽",
        "Резерв = (Зарплата + Накладные) × 3 + Защита × Площадь + Ремонт",
        (s.staff * entry.salary + e.overhead_per_month) * 3 + protect * area + e.tractor_repair,
      );
    case 14:
      return task(
        `Ожидаемый урожай без защиты ${ru(harvestT, 1)} т, цена ${ru(pt)} ₽/т. Защита стоит ${ru(protect)} ₽/га на ${ru(crop)} га и сохраняет 5 % этого урожая. Какова чистая выгода от защиты?`,
        "₽",
        "Выгода = Сохранённый урожай × Цена − Затраты на защиту",
        harvestT * 0.05 * pt - protect * crop,
      );
    case 15:
      return task(
        `Ожидаемый урожай ${ru(harvestT, 1)} т, цена ${ru(pt)} ₽/т. Без ремонта комбайн уберёт только 60 % урожая. Сколько стоят потери без ремонта?`,
        "₽",
        "Потери = Урожай × Доля потерь × Цена",
        harvestT * 0.4 * pt,
      );
    default: {
      const rep = seasonReport(entry),
        rev = Math.round(rep.revenue / 100),
        profit = Math.round(rep.profit / 100);
      if (rev > 0)
        return task(
          `За сезон выручка ${ru(rev)} ₽, прибыль ${ru(profit)} ₽. Какова рентабельность продаж?`,
          "%",
          "Рентабельность продаж = Прибыль ÷ Выручка × 100 %",
          (profit / rev) * 100,
          1,
        );
      const q = t(s.inventory);
      return task(
        `На складе ${ru(q, 1)} т, цена ${ru(pt)} ₽/т. Сколько стоит весь запас зерна по рыночной цене?`,
        "₽",
        "Стоимость запаса = Количество × Цена",
        q * pt,
      );
    }
  }
}
/** Оценка расчёта: 1 — точно (до 1 %), 0,5 — близко (до 5 %), 0 — неверно. */
export function scoreCalc(task: CalcTask, given: number) {
  if (!Number.isFinite(given)) return 0;
  const unit = 0.5 * Math.pow(10, -task.digits),
    diff = Math.abs(given - task.answer),
    base = Math.abs(task.answer);
  if (diff <= Math.max(unit, base * 0.01)) return 1;
  if (diff <= Math.max(unit, base * 0.05)) return 0.5;
  return 0;
}
