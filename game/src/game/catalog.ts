import type { Option, GameState } from "./engine";
import campaign from "./campaign.json" with { type: "json" };
export const LEVELS = campaign.levels.map((level) => ({
  ...level,
  mechanic:
    level.id === 1
      ? "Выбери площадь аренды и сохрани деньги на посев"
      : level.mechanic,
}));
export const SEASONS = [
  { name: "Первое поле", role: "Фермер", color: "#738d49" },
  { name: "Время расти", role: "Предприниматель", color: "#bb8643" },
  { name: "Деньги во времени", role: "Финансист", color: "#577f96" },
  { name: "Твоё решение", role: "Управляющий", color: "#8a779e" },
];
export const MONTHS = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];
export const currency = (kopecks: number, compact = false) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: compact ? 1 : 0,
    ...(compact ? { notation: "compact" as const } : {}),
  }).format(kopecks / 100);
export const tons = (kg: number) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(
    kg / 1000,
  ) + " т";
export const points = (hundredths: number) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(
    hundredths / 100,
  );
const values: Record<string, string> = {
  economy: "Экономичные семена",
  standard: "Стандарт",
  premium: "Отборные семена",
  low: "Малая доза",
  high: "Повышенная доза",
  own: "Свой склад",
  lease250: "Ещё 250 т",
  lease500: "Ещё 500 т",
  flex: "За каждую тонну",
  package: "Пакет перевозки",
  express: "Экспресс",
  monthly: "Ровная зарплата",
  seasonal: "Оклад и сезонный бонус",
  overtime: "Повышенный оклад",
  none: "Оставить как есть",
  buy: "Купить улучшение",
  lease: "Арендовать улучшение",
  now: "Продать сейчас",
  split: "Разделить партию",
  forward: "Ноябрьский контракт",
  normal: "Обычная оплата",
  prepay: "Предоплата со скидкой",
  installment: "Отсрочка поставщика",
  intensive: "Усиленная защита",
  repair: "Полный ремонт",
  contractor: "Услуги подрядчика",
  partial: "Частичный ремонт",
  skip: "Продолжить без ремонта",
  cash: "Завершить расчёты",
  store_half: "Оставить половину урожая",
  discount: "Продать со скидкой",
};
export function optionText(o: Option, g: GameState, level: number) {
  const l = LEVELS[level - 1];
  let title = "",
    detail = "";
  if (o.area !== undefined) {
    title = `${o.area} га`;
    detail = o.seed ? values[String(o.seed)] : "Аренда и план производства";
  }
  if (o.fertilizer) {
    title = values[String(o.fertilizer)];
    detail = `${({ low: 1000, standard: 2500, high: 5000 } as Record<string, number>)[String(o.fertilizer)]} ₽/га · отдача зависит от бюджета`;
  }
  if (o.storage) {
    title = values[String(o.storage)];
    detail = (
      {
        own: "Без аренды · вместимость 1000 т",
        lease250: "50 000 ₽ · общая вместимость 1250 т",
        lease500: "100 000 ₽ · общая вместимость 1500 т",
      } as Record<string, string>
    )[String(o.storage)];
    if (o.repay_on_return) {
      title += " + погасить долг";
      detail += " · после возврата размещения";
    }
  }
  if (o.fraction !== undefined) {
    title = `${Number(o.fraction) / 100} % ${[8, 16].includes(level) ? "плана" : "партии"}`;
    detail =
      l.type === "seed_prepay"
        ? "Предоплата семян · скидка 10 %"
        : l.type === "rent_prepay"
          ? "Будущая аренда · скидка 5 %"
          : `${tons(Math.floor((g.s.inventory * Number(o.fraction)) / 10000))} · оставшаяся часть на складе`;
    if (o.deferred !== undefined)
      detail += o.deferred
        ? " · оплата позже, надбавка 6 %"
        : " · деньги сразу";
  }
  if (o.transport) {
    title = values[String(o.transport)];
    detail = (
      {
        flex: "Без платы за рейс · 500 ₽/т",
        package: "100 000 ₽ за рейс + 300 ₽/т",
        express: "Без платы за рейс · 800 ₽/т",
      } as Record<string, string>
    )[String(o.transport)];
  }
  if (o.deferred !== undefined && o.fraction === undefined) {
    title = o.deferred ? "Деньги через месяц" : "Деньги сейчас";
    detail = o.deferred
      ? "Надбавка к цене 3 % · появляется долг покупателя"
      : "Обычная цена · немедленное поступление";
  }
  if (o.staff !== undefined) {
    title = `${o.staff} работников`;
    detail = `Мощность ${Number(o.staff) * 50} га · 30 000 ₽/чел. в месяц`;
  }
  if (o.wages) {
    title = values[String(o.wages)];
    detail = (
      {
        monthly: "30 000 ₽/мес. · без бонуса",
        seasonal: "25 000 ₽/мес. + 40 000 ₽/чел. в августе",
        overtime: "34 000 ₽/мес. · без бонуса",
      } as Record<string, string>
    )[String(o.wages)];
  }
  if (o.equipment) {
    title = values[String(o.equipment)];
    detail = (
      {
        none: "Прежняя стоимость полевых работ",
        buy: "2 млн ₽ · экономия 1500 ₽/га за сезон",
        lease: "350 000 ₽ за сезон · экономия 1500 ₽/га",
      } as Record<string, string>
    )[String(o.equipment)];
  }
  if (o.plan) {
    title = values[String(o.plan)];
    detail = (
      {
        now: "Вся партия · деньги по текущей цене",
        split: "Половина сейчас, остаток по ноябрьскому договору",
        forward: "Подписанный договор · хранение и потери продолжаются",
      } as Record<string, string>
    )[String(o.plan)];
  }
  if (o.deposit !== undefined) {
    title = Number(o.deposit)
      ? currency(Number(o.deposit), true)
      : "Сохранить деньги доступными";
    detail = Number(o.deposit)
      ? `До августа · доход ${currency(Math.round(Number(o.deposit) * 0.04))} · до возврата не снять`
      : "Без дохода от размещения · свободный резерв";
  }
  if (o.procurement) {
    title = values[String(o.procurement)];
    detail = (
      {
        normal: "Оплатить семена при посеве",
        prepay: "Оплатить сейчас · скидка 5 %",
        installment: "Оплата в июне · надбавка 2 %",
      } as Record<string, string>
    )[String(o.procurement)];
  }
  if (o.borrow !== undefined) {
    title = Number(o.borrow)
      ? `Занять ${currency(Number(o.borrow), true)}`
      : "Обойтись своими средствами";
    detail = Number(o.borrow)
      ? "12 % годовых · лимит 3 млн ₽ · основной долг отдельно от процентов"
      : "Подходит, если хватает денег по календарю";
  }
  if (o.repay !== undefined) {
    title = Number(o.repay)
      ? `Погасить ${currency(Number(o.repay), true)}`
      : "Сохранить деньги до следующих поступлений";
    detail = "Проверь выплаты и стоимость процентов";
    if (o.rent_fraction !== undefined) {
      title = `Предоплатить ${Number(o.rent_fraction) / 100} % аренды`;
      detail = "Следующий сезон · скидка 5 %";
    }
    if (o.prepay_harvest !== undefined) {
      title = o.prepay_harvest
        ? "Оплатить уборку заранее"
        : "Оплатить уборку в августе";
      detail = o.prepay_harvest
        ? "Скидка 5 % · деньги уйдут сейчас"
        : "Без скидки · деньги пока остаются доступными";
    }
  }
  if (o.reserve !== undefined) {
    title = currency(Number(o.reserve), true);
    detail = "Три месяца выплат + погодные работы + ремонт";
  }
  if (o.weather) {
    title = (
      {
        none: "Ничего не менять",
        standard: "Обычная защита",
        intensive: "Усиленная защита",
      } as Record<string, string>
    )[String(o.weather)];
    detail = (
      {
        none: "Без дополнительных затрат · сохраняется погодный риск",
        standard: "600 ₽/га · восстановить 5 п.п. урожайности",
        intensive: "1200 ₽/га · восстановить 8 п.п. урожайности",
      } as Record<string, string>
    )[String(o.weather)];
  }
  if (o.repair) {
    title = values[String(o.repair)] + " · " + values[String(o.storage)];
    detail =
      (
        {
          repair: "400 000 ₽ · полная мощность",
          contractor: "450 000 ₽ · полная мощность",
          partial: "250 000 ₽ · 85 % мощности",
          skip: "Без оплаты · 60 % мощности",
        } as Record<string, string>
      )[String(o.repair)] +
      ". " +
      detail;
  }
  if (o.factor !== undefined) {
    title = o.factor ? "Получить оплату раньше" : "Дождаться декабря";
    detail = o.factor
      ? "Комиссия 1 % от суммы покупателя"
      : "Без комиссии · проверь ближайшие платежи";
  }
  if (o.final) {
    title = values[String(o.final)];
    detail = (
      {
        cash: "Продать остаток по обычной цене, исполнить заказ и сохранить резерв",
        store_half: "Продать половину, остаток оценить с учётом риска хранения",
        discount: "Быстрая продажа на 20 % дешевле обычной цены",
      } as Record<string, string>
    )[String(o.final)];
  }
  return { title, detail };
}
