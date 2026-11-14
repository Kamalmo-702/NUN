/**
 * Defensive readers for backend payloads. Endpoint schemas were not supplied with the
 * project, so these inspect the real response and report what could not be found
 * (`missing`) instead of inventing values.
 */
export type Row = Record<string, unknown>;
export interface Point {
  t: number; // UTC ms
  v: number;
}

const isObj = (v: unknown): v is Row => typeof v === "object" && v !== null && !Array.isArray(v);
const isRowArray = (v: unknown): v is Row[] =>
  Array.isArray(v) && v.length > 0 && v.every(isObj);

export function toNum(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
}

export function parseDate(v: unknown): number {
  if (typeof v === "number") {
    if (v > 1e11) return v;
    if (v > 1900 && v < 2200) return Date.UTC(v, 0, 1);
    return NaN;
  }
  if (typeof v !== "string") return NaN;
  const s = v.trim();
  if (/^\d{4}-\d{2}$/.test(s)) return Date.parse(`${s}-01T00:00:00Z`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return Date.parse(`${s}T00:00:00Z`);
  if (/^\d{4}-\d{2}-\d{2}[T ]/.test(s)) return Date.parse(s);
  return NaN;
}

/** Pull a list of records out of the common payload shapes. */
export function extractRows(p: unknown): Row[] {
  if (isRowArray(p)) return p;
  if (!isObj(p)) return [];
  const vals = Object.values(p);
  // columnar: { date: [...], value: [...] }
  if (vals.length > 0 && vals.every(Array.isArray)) {
    const cols = Object.entries(p) as [string, unknown[]][];
    const n = cols[0][1].length;
    if (n > 0 && cols.every(([, c]) => c.length === n && c.every((x) => !isObj(x)))) {
      return Array.from({ length: n }, (_, i) => Object.fromEntries(cols.map(([k, c]) => [k, c[i]])));
    }
  }
  const preferred = ["data", "series", "records", "items", "rows", "results", "evidence", "discoveries", "trends"];
  for (const k of preferred) if (isRowArray(p[k])) return p[k] as Row[];
  for (const v of vals) if (isRowArray(v)) return v;
  for (const v of vals) if (isObj(v)) { const r = extractRows(v); if (r.length) return r; }
  // object of objects: { southern: {...}, northern: {...} }
  if (vals.length > 0 && vals.every(isObj)) {
    return Object.entries(p).map(([k, v]) => ({ _key: k, ...(v as Row) }));
  }
  return [];
}

export function findKey(row: Row | undefined, re: RegExp, test?: (v: unknown) => boolean): string | undefined {
  if (!row) return undefined;
  return Object.keys(row).find((k) => re.test(k) && (!test || test(row[k])));
}

export function dateKeyOf(rows: Row[]): string | undefined {
  const first = rows[0];
  if (!first) return undefined;
  return (
    findKey(first, /^(date|month|time|timestamp|period|ds|observation)/i, (v) => !Number.isNaN(parseDate(v))) ??
    Object.keys(first).find((k) => typeof first[k] === "string" && !Number.isNaN(parseDate(first[k])))
  );
}

export function rowTime(row: Row, dk?: string): number {
  if (dk) return parseDate(row[dk]);
  const y = toNum(row.year);
  const m = toNum(row.month);
  if (!Number.isNaN(y) && !Number.isNaN(m)) return Date.UTC(y, m - 1, 1);
  return NaN;
}

function pointsFrom(rows: Row[], dk: string | undefined, vk: string): Point[] {
  return rows
    .map((r) => ({ t: rowTime(r, dk), v: toNum(r[vk]) }))
    .filter((p) => !Number.isNaN(p.t))
    .sort((a, b) => a.t - b.t);
}

const EXCLUDE_NUMERIC = /^(id|index|year|month|day|n|count|_key)$/i;

export function numericKeys(rows: Row[], skip?: string): string[] {
  const first = rows[0] ?? {};
  return Object.keys(first).filter(
    (k) => k !== skip && !EXCLUDE_NUMERIC.test(k) && rows.some((r) => !Number.isNaN(toNum(r[k]))),
  );
}

export interface SeriesRead {
  points: Point[];
  valueKey: string;
}

/** Single time series, e.g. /api/series. */
export function readSeries(payload: unknown, preferRe = /open.?water|area|extent|km2|total|value/i): SeriesRead | null {
  const rows = extractRows(payload);
  if (!rows.length) return null;
  const dk = dateKeyOf(rows);
  const hasYM = !dk && !Number.isNaN(rowTime(rows[0]));
  if (!dk && !hasYM) return null;
  const keys = numericKeys(rows, dk);
  const vk = keys.find((k) => preferRe.test(k)) ?? keys[0];
  if (!vk) return null;
  const points = pointsFrom(rows, dk, vk);
  return points.length ? { points, valueKey: vk } : null;
}

export interface PoolsRead {
  south: Point[];
  north: Point[];
  total: Point[];
  missing: string[];
}

export function readPools(payload: unknown): PoolsRead | null {
  const rows = extractRows(payload);
  if (!rows.length) return null;
  const dk = dateKeyOf(rows);
  if (!dk && Number.isNaN(rowTime(rows[0]))) return null;
  const out: PoolsRead = { south: [], north: [], total: [], missing: [] };
  const first = rows[0];
  const NOT_SHARE = (k: string) => !/share|pct|percent|frac|ratio|slope|tau|p_?val/i.test(k);
  const strKey = Object.keys(first).find((k) => k !== dk && typeof first[k] === "string" && /pool|name|region|series|zone/i.test(k));
  if (strKey) {
    // long format: one row per pool per date
    const groups: Record<"south" | "north" | "total", Row[]> = { south: [], north: [], total: [] };
    for (const r of rows) {
      const n = String(r[strKey]);
      if (/south/i.test(n)) groups.south.push(r);
      else if (/north/i.test(n)) groups.north.push(r);
      else if (/total|lake|reconcil/i.test(n)) groups.total.push(r);
    }
    const vk = numericKeys(rows, dk).find((k) => /area|extent|km2|value|open/i.test(k)) ?? numericKeys(rows, dk)[0];
    if (vk) for (const g of ["south", "north", "total"] as const) out[g] = pointsFrom(groups[g], dk, vk);
  } else {
    const keys = numericKeys(rows, dk).filter(NOT_SHARE);
    const south = keys.find((k) => /south/i.test(k));
    const north = keys.find((k) => /north/i.test(k));
    const total = keys.find((k) => /total|lake|reconcil/i.test(k) && !/south|north/i.test(k));
    if (south) out.south = pointsFrom(rows, dk, south);
    if (north) out.north = pointsFrom(rows, dk, north);
    if (total) out.total = pointsFrom(rows, dk, total);
  }
  if (!out.south.length) out.missing.push("Southern Pool");
  if (!out.north.length) out.missing.push("Northern Pool");
  if (!out.total.length) out.missing.push("Lake Total");
  return out.south.length || out.north.length || out.total.length ? out : null;
}

export interface TrendRow {
  name: string;
  slope?: number;
  tau?: number;
  p?: number;
  note?: string;
  unit?: string;
}

export function readTrends(payload: unknown): TrendRow[] {
  // NUN's API returns named trend objects rather than an array.
  if (isObj(payload)) {
    const named = [
      ["lake", "Lake Chad"],
      ["south_pool", "Southern Pool"],
      ["north_pool", "Northern Pool"],
    ] as const;
    const rows = named.flatMap(([key, name]) => {
      const raw = payload[key];
      if (!isObj(raw)) return [];
      return [{
        name,
        slope: toNum(raw.sen_slope_km2_per_year),
        tau: toNum(raw.tau),
        p: toNum(raw.p_value),
        note: typeof raw.method === "string" ? raw.method : undefined,
        unit: "km²/year",
      }];
    });
    if (rows.length) return rows;
  }
  return extractRows(payload).map((r, i) => {
    const nameKey = findKey(r, /^(pool|name|series|region|target|variable|_key|scope)$/i, (v) => typeof v === "string");
    const slope = findKey(r, /sen|slope/i, (v) => !Number.isNaN(toNum(v)));
    const tau = findKey(r, /tau/i, (v) => !Number.isNaN(toNum(v)));
    const p = findKey(r, /(^|_)p(_?val(ue)?)?$/i, (v) => !Number.isNaN(toNum(v)));
    const note = findKey(r, /interpret|conclusion|summary|significan|direction|trend/i, (v) => typeof v === "string");
    const unit = findKey(r, /unit/i, (v) => typeof v === "string");
    return {
      name: nameKey ? String(r[nameKey]) : `Series ${i + 1}`,
      slope: slope ? toNum(r[slope]) : undefined,
      tau: tau ? toNum(r[tau]) : undefined,
      p: p ? toNum(r[p]) : undefined,
      note: note ? String(r[note]) : undefined,
      unit: unit ? String(r[unit]) : undefined,
    };
  });
}

export interface OverviewRead {
  latest?: { date: string; area: number };
  month?: { change: number; pct: number };
  year?: { change: number; pct: number };
  model?: { name: string; mae: number; r2: number };
}

/** Read the explicit /api/overview contract without manufacturing values. */
export function readOverview(payload: unknown): OverviewRead | null {
  if (!isObj(payload)) return null;
  const latest = isObj(payload.latest_observation) ? payload.latest_observation : undefined;
  const month = isObj(payload.month_over_month) ? payload.month_over_month : undefined;
  const year = isObj(payload.year_over_year) ? payload.year_over_year : undefined;
  const model = isObj(payload.selected_metrics) ? payload.selected_metrics : undefined;
  return {
    latest: latest && typeof latest.date === "string" ? { date: latest.date, area: toNum(latest.open_water_area_km2) } : undefined,
    month: month ? { change: toNum(month.change_km2), pct: toNum(month.change_pct) } : undefined,
    year: year ? { change: toNum(year.change_km2), pct: toNum(year.change_pct) } : undefined,
    model: model && typeof payload.selected_model === "string" ? { name: payload.selected_model, mae: toNum(model.mae_km2), r2: toNum(model.r2) } : undefined,
  };
}

export interface EvidenceRead {
  citation?: string;
  license?: string;
  start?: string;
  end?: string;
  observations?: number;
  units?: string;
  capabilities: string[];
  exclusions: string[];
}

/** Read source, coverage, and limits from NUN's /api/evidence response. */
export function readEvidence(payload: unknown): EvidenceRead | null {
  if (!isObj(payload)) return null;
  const source = isObj(payload.source) ? payload.source : {};
  const coverage = isObj(payload.coverage) ? payload.coverage : {};
  return {
    citation: typeof source.citation === "string" ? source.citation : undefined,
    license: typeof source.license === "string" ? source.license : undefined,
    start: typeof coverage.start === "string" ? coverage.start : undefined,
    end: typeof coverage.end === "string" ? coverage.end : undefined,
    observations: toNum(coverage.observations),
    units: typeof coverage.units === "string" ? coverage.units : undefined,
    capabilities: Array.isArray(payload.data_capabilities) ? payload.data_capabilities.filter((x): x is string => typeof x === "string") : [],
    exclusions: Array.isArray(payload.out_of_scope_without_new_data) ? payload.out_of_scope_without_new_data.filter((x): x is string => typeof x === "string") : [],
  };
}

export interface DiscoveryRead {
  id: string;
  region?: string;
  variable?: string;
  reliability?: string;
  slope?: number;
  tau?: number;
  p?: number;
  date?: string;
  south?: number;
  north?: number;
}

/** Read NUN discovery cards, preserving nested statistical evidence. */
export function readDiscoveries(payload: unknown): DiscoveryRead[] {
  if (!isObj(payload) || !Array.isArray(payload.cards)) return [];
  return payload.cards.filter(isObj).map((card, index) => {
    const evidence = isObj(card.evidence) ? card.evidence : {};
    return {
      id: typeof card.id === "string" ? card.id : `discovery-${index + 1}`,
      region: typeof card.region === "string" ? card.region : undefined,
      variable: typeof card.variable === "string" ? card.variable : undefined,
      reliability: typeof card.reliability === "string" ? card.reliability : undefined,
      slope: toNum(evidence.sen_slope_km2_per_year),
      tau: toNum(evidence.tau),
      p: toNum(evidence.p_value),
      date: typeof evidence.date === "string" ? evidence.date : undefined,
      south: toNum(evidence.south_open_water_km2),
      north: toNum(evidence.north_open_water_km2),
    };
  });
}

export interface ForecastRead {
  history: Point[];
  forecast: Point[];
  missing: string[];
}

export function readForecast(payload: unknown): ForecastRead | null {
  const out: ForecastRead = { history: [], forecast: [], missing: [] };
  const sub = (re: RegExp): unknown => {
    if (!isObj(payload)) return undefined;
    const k = Object.keys(payload).find((x) => re.test(x) && (Array.isArray(payload[x]) || isObj(payload[x])));
    return k ? payload[k] : undefined;
  };
  const histPayload = sub(/hist|observ|actual/i);
  const fcPayload = sub(/forecast|proj|predict/i);
  if (histPayload || fcPayload) {
    const h = histPayload ? readSeries(histPayload, /actual|observ|open|area|value/i) : null;
    const f = fcPayload ? readSeries(fcPayload, /forecast|pred|yhat|value/i) : null;
    if (h) out.history = h.points;
    if (f) out.forecast = f.points.filter((p) => !Number.isNaN(p.v));
  } else {
    const rows = extractRows(payload);
    const dk = rows.length ? dateKeyOf(rows) : undefined;
    if (rows.length && (dk || !Number.isNaN(rowTime(rows[0])))) {
      const keys = numericKeys(rows, dk);
      const fk = keys.find((k) => /forecast|pred|yhat|proj/i.test(k));
      const ak = keys.find((k) => /actual|observ|open|area/i.test(k) && k !== fk);
      if (ak) out.history = pointsFrom(rows, dk, ak).filter((p) => !Number.isNaN(p.v));
      if (fk) out.forecast = pointsFrom(rows, dk, fk).filter((p) => !Number.isNaN(p.v));
      if (!fk && keys[0]) out.forecast = pointsFrom(rows, dk, keys[0]).filter((p) => !Number.isNaN(p.v));
    }
  }
  if (!out.forecast.length) out.missing.push("forecast values");
  return out.forecast.length || out.history.length ? out : null;
}

/** Generic record reader for evidence and discoveries. */
export interface Record3 {
  title?: string;
  text?: string;
  period?: string;
  measure?: string;
  extra: [string, string][];
}

export function readRecords(payload: unknown): Record3[] {
  const rows = extractRows(payload);
  return rows.map((r) => {
    const used = new Set<string>();
    const pick = (re: RegExp, onlyStr = true) => {
      const k = Object.keys(r).find((x) => !used.has(x) && re.test(x) && r[x] != null && (!onlyStr || typeof r[x] === "string"));
      if (k) used.add(k);
      return k ? String(r[k]) : undefined;
    };
    const title = pick(/^(title|headline|name|label|claim|id|key|_key)$/i);
    const text = pick(/^(summary|description|insight|finding|detail|text|explanation|statement|note|evidence|significance|interpretation)/i);
    const period = pick(/period|range|window|date|years?$/i, false);
    const measure = pick(/measure|metric|value|result|statistic|magnitude|change/i, false);
    const extra = Object.entries(r)
      .filter(([k, v]) => !used.has(k) && v != null && typeof v !== "object")
      .map(([k, v]) => [k.replace(/_/g, " "), String(v)] as [string, string]);
    return { title, text, period, measure, extra };
  });
}

/* ---------- formatting ---------- */
const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
export const fmtKm2 = (v: number) => (Number.isFinite(v) ? nf0.format(v) : "—");
export const fmtNum = (v: number | undefined, d = 2) =>
  v === undefined || !Number.isFinite(v) ? "—" : v.toLocaleString("en-US", { maximumFractionDigits: d });
export const fmtP = (p: number | undefined) =>
  p === undefined || !Number.isFinite(p) ? "—" : p < 0.001 ? "< 0.001" : p.toFixed(3);
const dfMonth = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
export const fmtMonth = (t: number) => dfMonth.format(t);
export const fmtYear = (t: number) => new Date(t).getUTCFullYear();
