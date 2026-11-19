import type { GameState } from "./engine";

const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const FIELDS = [
  "M0 379 235 283 512 410 182 550H0Z",
  "M296 291 561 214 805 338 574 430Z",
  "M495 550 618 436 852 358 1000 419V550Z",
];
const SPROUTS = [
  [60, 420], [120, 450], [170, 400], [230, 440], [300, 410], [90, 500], [250, 480],
  [400, 290], [460, 320], [520, 270], [600, 300], [650, 350], [560, 380], [700, 320],
  [640, 490], [720, 450], [800, 430], [880, 470], [940, 450], [780, 500],
];

/** Стадия поля по месяцу и состоянию хозяйства. */
function stage(g: GameState | undefined) {
  if (!g || !g.month) return { key: "idle", text: "земля ждёт решения" };
  const m = ((g.month - 1) % 12) + 1;
  if (g.harvested) return { key: "stubble", text: "урожай убран" };
  if (g.crop_area) {
    if (m <= 5) return { key: "young", text: "всходы" };
    if (m <= 7) return { key: "green", text: "пшеница растёт" };
    return { key: "ripe", text: "колос созрел" };
  }
  if (m <= 3 || m === 12) return { key: "snow", text: "зима, поле отдыхает" };
  return { key: "plowed", text: "поле готово к посеву" };
}
const FILL: Record<string, string> = {
  idle: "#cfc8a6",
  snow: "#eef1ea",
  plowed: "#b99a6b",
  young: "#c5d88d",
  green: "#8fb158",
  ripe: "#e2c060",
  stubble: "#dac99c",
  fallow: "#d7d2b4",
};

export default function FarmScene({
  state,
  large = false,
  preview = false,
}: {
  state?: GameState;
  large?: boolean;
  preview?: boolean;
}) {
  const g = state;
  const m = g?.month ? ((g.month - 1) % 12) + 1 : 6;
  const season = g?.month ? Math.floor((g.month - 1) / 12) + 1 : 1;
  const st = stage(g);
  const area = g?.crop_area || g?.area || 0;
  const active = g ? Math.max(0, Math.min(3, Math.round((area / 500) * 3))) : 3;
  const capacity = 1000000 + (g?.storage_extra ?? 0);
  const fill = g ? Math.min(1, g.s.inventory / capacity) : 0;
  const staff = g?.s.staff ?? 12;
  const winter = st.key === "snow";
  const drought = season === 3 && m >= 5 && m <= 8;
  const stormy = season === 4 && m >= 6 && m <= 8;
  const trucks = !!g && (g.s.receivables.length > 0 || g.scheduled.length > 0);
  const debt = g ? g.s.debt + g.s.assistance + g.s.arrears : 0;
  const sprouts = ["young", "green", "ripe"].includes(st.key);
  const sky = winter ? ["#e6edf0", "#f6f7f2"] : drought ? ["#f3e2c2", "#fbf1d7"] : stormy ? ["#cfd8dc", "#eef0e6"] : ["#dcebe1", "#f9f6dc"];
  return (
    <div className={`farm-scene ${large ? "scene-large" : ""} ${preview ? "is-preview" : ""}`}>
      <svg viewBox="0 0 1000 550" role="img" aria-label={`Твоё хозяйство: ${area} га, ${st.text}, на складе ${Math.round((g?.s.inventory ?? 0) / 1000)} т`}>
        <defs>
          <linearGradient id="sky" x2="0" y2="1">
            <stop stopColor={sky[0]} style={{ transition: "stop-color .8s" }} />
            <stop offset="1" stopColor={sky[1]} />
          </linearGradient>
          <linearGradient id="silo" x2="1">
            <stop stopColor="#e3e6d8" />
            <stop offset=".5" stopColor="#faf9ef" />
            <stop offset="1" stopColor="#aebeb3" />
          </linearGradient>
          <pattern id="rows" width="30" height="30" patternUnits="userSpaceOnUse" patternTransform="rotate(-25)">
            <path d="M0 0V30" stroke="#fff4c7" strokeWidth="3" opacity=".4" />
          </pattern>
          <clipPath id="silo-clip">
            <path d="M0 24Q34-17 68 24v128q-34 23-68 0Z" />
          </clipPath>
          <filter id="shadow">
            <feDropShadow dx="0" dy="12" stdDeviation="12" floodColor="#435d35" floodOpacity=".14" />
          </filter>
        </defs>
        <rect width="1000" height="550" fill="url(#sky)" />
        <circle cx="815" cy="86" r={drought ? 62 : 45} fill={drought ? "#f2b75e" : "#f4d797"} opacity={stormy || winter ? 0.35 : 0.75} className="sun" />
        <g className="cloud" fill={stormy ? "#c3ccd0" : "#fff"} opacity=".8">
          <path d="M81 94c0-18 27-28 42-13 14-31 60-20 62 5 26-9 44 4 44 19H81Z" />
          <path d="M590 60c7-20 30-19 39-7 18-24 52-10 52 9 25-5 34 3 37 12H584Z" />
          {stormy && <path d="M330 70c7-20 30-19 39-7 18-24 52-10 52 9 25-5 34 3 37 12H324Z" />}
        </g>
        {stormy && (
          <g stroke="#9fb3bd" strokeWidth="3" opacity=".6" className="rain">
            {[350, 380, 410, 620, 650, 680].map((x) => (
              <path key={x} d={`M${x} 95l-12 30`} />
            ))}
          </g>
        )}
        <path d="M0 235Q130 109 307 213Q489 102 705 205Q850 126 1000 208V550H0Z" style={{ fill: winter ? "#e4eae2" : "#c4d4ac", transition: "fill .8s" }} />
        <path d="M0 290Q230 194 423 256Q711 182 1000 265V550H0Z" style={{ fill: winter ? "#dfe6dd" : drought ? "#c3bf8c" : "#aabd8b", transition: "fill .8s" }} />
        {FIELDS.map((d, i) => {
          const on = i < active;
          const color = on ? FILL[st.key] : winter ? FILL.snow : FILL.fallow;
          return (
            <g key={i}>
              <path d={d} style={{ fill: color, transition: "fill .8s" }} />
              {on && !winter && <path d={d} fill="url(#rows)" />}
            </g>
          );
        })}
        {sprouts && (
          <g className="sprouts" stroke={st.key === "ripe" ? "#b78f2f" : "#557b3a"} strokeWidth="3" strokeLinecap="round">
            {SPROUTS.filter((_, i) => i < Math.ceil((SPROUTS.length * active) / 3)).map(([x, y]) => {
              const h = st.key === "young" ? 6 : st.key === "green" ? 12 : 16;
              return <path key={`${x}-${y}`} d={`M${x} ${y}v-${h}M${x} ${y - h}l-4 -5M${x} ${y - h}l4 -5`} />;
            })}
          </g>
        )}
        <path d="M1000 270C809 316 847 396 657 440S440 473 341 550" fill="none" stroke="#e8d7b5" strokeWidth="39" />
        <path d="M1000 270C809 316 847 396 657 440S440 473 341 550" fill="none" stroke="#f4e6ca" strokeWidth="25" />
        <ellipse cx="545" cy="363" rx="183" ry="39" fill="#829366" opacity=".3" />
        <g filter="url(#shadow)">
          <path d="m465 242 130-42 78 70-126 47Z" fill="#9f5947" />
          <path d="m465 242 82 75v98l-82-51Z" fill="#e4dbc2" />
          <path d="m547 317 126-47v99l-126 46Z" fill="#f8f0d6" />
          <path d="m452 246 139-50 96 73-14 12-82-65-124 45Z" fill={winter ? "#eef0ec" : "#ad6550"} />
          <path d="m570 331 46-16v76l-46 17Z" fill="#617760" />
          <path d="m626 315 23-9v29l-23 9Z" fill="#b5c7b6" />
          <path d="m484 298 22 15v26l-22-14Z" fill="#b1c3ae" />
          <g transform="translate(704 207)">
            <path d="M0 24Q34-17 68 24v128q-34 23-68 0Z" fill="url(#silo)" />
            <g clipPath="url(#silo-clip)">
              <rect x="0" y="0" width="68" height="170" fill="#e0b85a" className="silo-fill" style={{ transform: `translateY(${170 - 150 * fill}px)` }} />
            </g>
            <ellipse cx="34" cy="24" rx="34" ry="12" fill="#e5e7da" />
            <path d="M0 24 34 0l34 24" fill="#8ea597" />
            <path d="M7 64q30 17 54 0M7 108q30 17 54 0" fill="none" stroke="#a2b6a4" strokeWidth="3" />
            <path d="M56 43v117" stroke="#7c8e81" strokeWidth="3" />
          </g>
          {g && g.storage_extra > 0 && (
            <g transform="translate(790 290)" className="pop-in">
              <path d="M0 50 40 0h60l40 50Z" fill="#dfe6da" />
              <path d="M0 50h140v32H0Z" fill="#c9d3c3" />
              <path d="M58 82V58h24v24" fill="#8a9b86" />
            </g>
          )}
        </g>
        <g className="tractor" transform="translate(302 354)">
          <ellipse cx="38" cy="36" rx="66" ry="13" fill="#7e8a60" opacity=".3" />
          <path d="m0 3 70-10 27 22-71 15Z" fill="#6f8551" />
          <path d="M7-8h38V13H7Z" fill="#426648" />
          <path d="m12-27 26-4 12 18-38 4Z" fill="#3e644c" />
          <path d="m17-24 17-2 7 12-24 2Z" fill="#bdd5cb" />
          <path d="m44 0 25-3 16 13-26 5Z" fill="#c2c67a" />
          <circle cx="14" cy="22" r="17" fill="#394c3b" />
          <circle cx="14" cy="22" r="8" fill="#d3c19a" />
          <circle cx="67" cy="22" r="12" fill="#394c3b" />
          <circle cx="67" cy="22" r="5" fill="#d3c19a" />
        </g>
        {g?.efficiency && (
          <g className="tractor pop-in" transform="translate(150 300) scale(.85)">
            <path d="m0 3 70-10 27 22-71 15Z" fill="#2f6c8f" />
            <path d="M7-8h38V13H7Z" fill="#245a78" />
            <path d="m17-24 17-2 7 12-24 2Z" fill="#cfe6f1" />
            <path d="m12-27 26-4 12 18-38 4Z" fill="#2c6587" />
            <circle cx="14" cy="22" r="17" fill="#2b3a40" />
            <circle cx="67" cy="22" r="12" fill="#2b3a40" />
          </g>
        )}
        <g className="workers">
          {Array.from({ length: Math.min(8, Math.ceil(staff / 2)) }, (_, i) => (
            <g key={i} transform={`translate(${430 + i * 18} ${440 + (i % 2) * 8})`}>
              <circle cx="0" cy="-16" r="5" fill="#e3c4a0" />
              <path d="M-5-10h10l2 14H-7Z" fill={["#3f6b8c", "#a6563f", "#5d7f45"][i % 3]} />
            </g>
          ))}
        </g>
        {trucks && (
          <g className="truck" transform="translate(760 400) rotate(-14)">
            <path d="M0 0h64v28H0Z" fill="#e2c060" />
            <path d="M64 6h22l10 12v10H64Z" fill="#b5523b" />
            <path d="M70 9h12l6 8H70Z" fill="#d7ecf0" />
            <circle cx="16" cy="30" r="8" fill="#33433a" />
            <circle cx="78" cy="30" r="8" fill="#33433a" />
          </g>
        )}
        <g fill={winter ? "#a9b9a3" : "#688759"}>
          <path d="M859 258q-31-32-3-57-5-38 27-36 33 1 27 35 23 32-10 54Z" />
          <path d="M194 272q-27-29-6-50-3-31 25-29 29 1 24 30 20 29-7 46Z" />
          <path d="M100 324q-26-22-5-44-5-23 20-25 24 2 23 24 21 25-7 43Z" />
        </g>
        <g stroke="#6f7951" strokeWidth="7">
          <path d="M879 224v69M211 241v54M116 290v48" />
        </g>
        <path d="M850 489c32-29 86-24 109-3s-18 46-65 39-67-18-44-36" fill={drought ? "#c7c6a3" : winter ? "#dfe9ee" : "#a1bcb0"} />
        {debt > 0 && (
          <g transform="translate(40 40)" className="pop-in">
            <rect width="150" height="44" rx="22" fill="#fff4ef" stroke="#c46a4f" strokeWidth="2" />
            <text x="75" y="28" textAnchor="middle" fontSize="18" fill="#9b3f28" fontWeight="600">
              долг {Math.round(debt / 100000000 * 10) / 10} млн ₽
            </text>
          </g>
        )}
      </svg>
      <span className="scene-label land-label">
        {g ? `${area} га` : "500 га"} <i>{st.text}</i>
      </span>
      <span className="scene-label store-label">
        {g ? `${Math.round(g.s.inventory / 1000)} из ${Math.round(capacity / 1000)} т` : "Склад 1000 т"}
        <i>{g?.month ? `${MONTHS_SHORT[m - 1]} · сезон ${season}` : "твой склад"}</i>
      </span>
      {preview && <span className="preview-tag">Так будет после решения</span>}
    </div>
  );
}
