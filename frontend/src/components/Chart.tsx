import { memo, useEffect, useMemo, useRef, useState } from "react";
import { fmtKm2, fmtMonth, type Point } from "../lib/normalize";

export interface ChartSeries {
  id: string;
  label: string;
  color: string;
  points: (Point & { anchor?: boolean })[];
  kind?: "line" | "bar";
  dashed?: boolean;
  /** marker style for each non-anchor point */
  markers?: "none" | "filled" | "hollow";
  /** bars: colour for negative values */
  negativeColor?: string;
  width?: number;
}
export interface Band {
  from: number;
  to: number;
  label: string;
}

interface Props {
  series: ChartSeries[];
  unit?: string;
  yTitle?: string;
  height?: number;
  ariaLabel: string;
  bands?: Band[];
  zero?: boolean; // force zero line / baseline
  monthsOnly?: boolean; // x axis is calendar months (seasonal pattern)
  xDomain?: [number, number];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function niceTicks(min: number, max: number, count = 5): number[] {
  if (min === max) { min -= 1; max += 1; }
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth || 640);
    const ro = new ResizeObserver((e) => setW(Math.max(260, Math.round(e[0].contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function monthTicks(min: number, max: number, innerW: number): { t: number; label: string }[] {
  const startY = new Date(min).getUTCFullYear();
  const endY = new Date(max).getUTCFullYear() + 1;
  const spanMonths = (max - min) / 2.63e9;
  const maxTicks = Math.max(2, Math.floor(innerW / 64));
  const step = [1, 3, 6, 12, 24, 60, 120].find((s) => spanMonths / s <= maxTicks) ?? 240;
  const out: { t: number; label: string }[] = [];
  for (let y = startY; y <= endY; y++) {
    for (let m = 0; m < 12; m += step >= 12 ? 12 : step) {
      if (step >= 12 && (y - startY) % (step / 12) !== 0) continue;
      const t = Date.UTC(y, m, 1);
      if (t < min || t > max) continue;
      out.push({ t, label: step >= 12 || m === 0 ? String(y) : `${MONTHS[m]} ${String(y).slice(2)}` });
    }
  }
  return out;
}

function ChartInner({ series, unit = "km²", yTitle, height = 360, ariaLabel, bands, zero, monthsOnly, xDomain }: Props) {
  const [wrapRef, width] = useWidth();
  const [cursor, setCursor] = useState<number | null>(null);
  const compact = width < 480;
  const m = { top: 14, right: compact ? 10 : 18, bottom: 30, left: compact ? 52 : 66 };
  const iw = width - m.left - m.right;
  const ih = height - m.top - m.bottom;

  const g = useMemo(() => {
    const pts = series.flatMap((s) => s.points.filter((p) => Number.isFinite(p.v)));
    if (!pts.length) return null;
    let tmin = xDomain?.[0] ?? Math.min(...pts.map((p) => p.t));
    let tmax = xDomain?.[1] ?? Math.max(...pts.map((p) => p.t));
    const hasBars = series.some((s) => s.kind === "bar");
    if (hasBars || monthsOnly) {
      const pad = monthsOnly ? 1.3e9 : 1.3e9;
      tmin -= pad; tmax += pad;
    }
    if (tmin === tmax) tmax = tmin + 2.63e9;
    let vmin = Math.min(...pts.map((p) => p.v));
    let vmax = Math.max(...pts.map((p) => p.v));
    if (zero || hasBars) { vmin = Math.min(vmin, 0); vmax = Math.max(vmax, 0); }
    const pad = (vmax - vmin) * 0.06 || 1;
    const ticks = niceTicks(zero || hasBars ? vmin : vmin - pad, vmax + pad, compact ? 4 : 5);
    const lo = Math.min(ticks[0], vmin), hi = Math.max(ticks[ticks.length - 1], vmax);
    const times = Array.from(new Set(pts.map((p) => p.t))).sort((a, b) => a - b);
    return { tmin, tmax, lo, hi, ticks, times };
  }, [series, zero, xDomain, monthsOnly, compact]);

  if (!g) return <div ref={wrapRef} style={{ height }} />;
  const x = (t: number) => m.left + ((t - g.tmin) / (g.tmax - g.tmin)) * iw;
  const y = (v: number) => m.top + (1 - (v - g.lo) / (g.hi - g.lo)) * ih;
  const xticks = monthsOnly
    ? Array.from({ length: 12 }, (_, i) => ({ t: Date.UTC(2001, i, 1), label: MONTHS[i] })).filter((tk) => tk.t >= g.tmin && tk.t <= g.tmax)
    : monthTicks(g.tmin, g.tmax, iw);

  const nearest = (clientX: number, rect: DOMRect) => {
    const t = g.tmin + ((clientX - rect.left - m.left) / iw) * (g.tmax - g.tmin);
    let best = g.times[0], d = Infinity;
    for (const tt of g.times) { const dd = Math.abs(tt - t); if (dd < d) { d = dd; best = tt; } }
    return best;
  };
  const move = (dir: 1 | -1) => {
    const i = cursor === null ? (dir === 1 ? -1 : g.times.length) : g.times.indexOf(cursor);
    const n = Math.min(g.times.length - 1, Math.max(0, i + dir));
    setCursor(g.times[n]);
  };

  const hit = cursor === null ? [] : series.map((s) => {
    const p = s.points.find((q) => q.t === cursor && !q.anchor && Number.isFinite(q.v));
    return p ? { s, p } : null;
  }).filter(Boolean) as { s: ChartSeries; p: Point }[];
  const cx = cursor === null ? 0 : x(cursor);
  const fmtT = (t: number) => (monthsOnly ? MONTHS[new Date(t).getUTCMonth()] : fmtMonth(t));
  const tipLeft = cx > width * 0.62;

  return (
    <div ref={wrapRef} className="chart" style={{ height }}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={ariaLabel}
        tabIndex={0}
        onPointerMove={(e) => setCursor(nearest(e.clientX, e.currentTarget.getBoundingClientRect()))}
        onPointerDown={(e) => setCursor(nearest(e.clientX, e.currentTarget.getBoundingClientRect()))}
        onPointerLeave={(e) => { if (e.pointerType === "mouse") setCursor(null); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") { e.preventDefault(); move(1); }
          else if (e.key === "ArrowLeft") { e.preventDefault(); move(-1); }
          else if (e.key === "Escape") setCursor(null);
        }}
        onBlur={() => setCursor(null)}
      >
        {bands?.map((b) => (
          <g key={b.label}>
            <rect x={x(b.from)} y={m.top} width={Math.max(0, x(b.to) - x(b.from))} height={ih} className="chart-band" />
            <text x={x(b.to) - 6} y={m.top + 12} textAnchor="end" className="chart-band-label">{b.label}</text>
          </g>
        ))}
        {g.ticks.map((v) => (
          <g key={v}>
            <line x1={m.left} x2={width - m.right} y1={y(v)} y2={y(v)} className={v === 0 && (zero || series.some((s) => s.kind === "bar")) ? "chart-zero" : "chart-grid"} />
            <text x={m.left - 8} y={y(v) + 4} textAnchor="end" className="chart-tick">{fmtKm2(v)}</text>
          </g>
        ))}
        {xticks.map((tk) => (
          <g key={tk.t}>
            <line x1={x(tk.t)} x2={x(tk.t)} y1={m.top + ih} y2={m.top + ih + 5} className="chart-axis" />
            <text x={x(tk.t)} y={height - 8} textAnchor="middle" className="chart-tick">{tk.label}</text>
          </g>
        ))}
        <line x1={m.left} x2={width - m.right} y1={m.top + ih} y2={m.top + ih} className="chart-axis" />
        <text x={11} y={m.top + ih / 2} transform={`rotate(-90 11 ${m.top + ih / 2})`} textAnchor="middle" className="chart-title">
          {yTitle ?? `Open-water extent (${unit})`}
        </text>
        {series.map((s) => {
          if (s.kind === "bar") {
            const bw = Math.max(1.5, (iw / Math.max(1, g.times.length)) * 0.72);
            return (
              <g key={s.id}>
                {s.points.filter((p) => Number.isFinite(p.v)).map((p) => (
                  <rect key={p.t} x={x(p.t) - bw / 2} width={bw} y={Math.min(y(p.v), y(0))} height={Math.max(0.5, Math.abs(y(p.v) - y(0)))} fill={p.v < 0 && s.negativeColor ? s.negativeColor : s.color} opacity={cursor === null || cursor === p.t ? 0.95 : 0.55} />
                ))}
              </g>
            );
          }
          // line with gaps for missing values
          let d = "";
          let pen = false;
          for (const p of s.points) {
            if (!Number.isFinite(p.v)) { pen = false; continue; }
            d += `${pen ? "L" : "M"}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`;
            pen = true;
          }
          const showMarkers = s.markers && s.markers !== "none";
          return (
            <g key={s.id}>
              <path d={d} fill="none" stroke={s.color} strokeWidth={s.width ?? 2} strokeDasharray={s.dashed ? "6 5" : undefined} strokeLinejoin="round" strokeLinecap="round" />
              {showMarkers && s.points.filter((p) => !p.anchor && Number.isFinite(p.v)).map((p) => (
                <circle key={p.t} cx={x(p.t)} cy={y(p.v)} r={5} stroke={s.color} strokeWidth={2} fill={s.markers === "filled" ? s.color : "var(--card)"} />
              ))}
            </g>
          );
        })}
        {cursor !== null && (
          <g pointerEvents="none">
            <line x1={cx} x2={cx} y1={m.top} y2={m.top + ih} className="chart-cursor" />
            {hit.filter((h) => h.s.kind !== "bar").map(({ s, p }) => (
              <circle key={s.id} cx={cx} cy={y(p.v)} r={4} fill={s.color} stroke="var(--card)" strokeWidth={2} />
            ))}
          </g>
        )}
      </svg>
      {cursor !== null && hit.length > 0 && (
        <div className="chart-tip" style={{ top: m.top + 6, [tipLeft ? "right" : "left"]: tipLeft ? width - cx + 12 : cx + 12 }} role="status">
          <strong>{fmtT(cursor)}</strong>
          {hit.map(({ s, p }) => (
            <span key={s.id}><i style={{ background: s.color }} />{s.label}<b>{fmtKm2(p.v)} {unit}</b></span>
          ))}
        </div>
      )}
    </div>
  );
}
export const Chart = memo(ChartInner);

export function Legend({ items }: { items: { label: string; color: string; style?: "line" | "dashed" | "filled" | "hollow" | "bar" }[] }) {
  return (
    <ul className="legend" aria-label="Chart legend">
      {items.map((it) => (
        <li key={it.label}>
          <svg width="26" height="12" aria-hidden="true">
            {it.style === "bar" ? <rect x="8" y="1" width="10" height="10" fill={it.color} /> : (
              <>
                <line x1="1" x2="25" y1="6" y2="6" stroke={it.color} strokeWidth="2" strokeDasharray={it.style === "dashed" || it.style === "hollow" ? "5 3" : undefined} />
                {(it.style === "filled" || it.style === "hollow") && <circle cx="13" cy="6" r="4" stroke={it.color} strokeWidth="2" fill={it.style === "filled" ? it.color : "var(--card)"} />}
              </>
            )}
          </svg>
          {it.label}
        </li>
      ))}
    </ul>
  );
}
