import { useMemo, useState } from "react";
import { Boundary, Notice } from "../components/Boundary";
import { Chart, Legend } from "../components/Chart";
import { JourneyNav, PageHead } from "../components/Layout";
import { TrendGlossary, TrendTable } from "../components/TrendStats";
import { useEndpoint } from "../hooks/useEndpoint";
import { SERIES_COLORS } from "../lib/facts";
import { fmtKm2, fmtMonth, readPools, readTrends, type PoolsRead } from "../lib/normalize";

const DEF = [
  { key: "total", label: "Lake Total", color: SERIES_COLORS.total },
  { key: "south", label: "Southern Pool", color: SERIES_COLORS.south },
  { key: "north", label: "Northern Pool", color: SERIES_COLORS.north },
] as const;

function PoolsView({ pools }: { pools: PoolsRead }) {
  const [on, setOn] = useState<Record<string, boolean>>({ total: true, south: true, north: true });
  const series = useMemo(
    () => DEF.filter((d) => on[d.key] && pools[d.key].length).map((d) => ({ id: d.key, label: d.label, color: d.color, points: pools[d.key], width: d.key === "total" ? 2.4 : 1.8 })),
    [on, pools],
  );
  // Latest date present in all three series, used for the reconciliation check.
  const latest = useMemo(() => {
    if (pools.missing.length) return null;
    const tot = new Map(pools.total.filter((p) => Number.isFinite(p.v)).map((p) => [p.t, p.v]));
    const n = new Map(pools.north.map((p) => [p.t, p.v]));
    for (let i = pools.south.length - 1; i >= 0; i--) {
      const s = pools.south[i];
      const t = tot.get(s.t), nv = n.get(s.t);
      if (t !== undefined && nv !== undefined && Number.isFinite(s.v) && Number.isFinite(nv)) return { t: s.t, s: s.v, n: nv, total: t };
    }
    return null;
  }, [pools]);
  const sum = latest ? latest.s + latest.n : 0;
  const diff = latest ? Math.abs(sum - latest.total) : 0;
  const sShare = latest ? (latest.s / sum) * 100 : 0;

  return (
    <>
      {pools.missing.length > 0 && <div style={{ marginBottom: 16 }}><Notice tone="warn" title="Partial data">The response does not include: {pools.missing.join(", ")}. Available series are shown.</Notice></div>}
      {latest && (
        <section aria-labelledby="eq-h" style={{ marginBottom: 32 }}>
          <h2 id="eq-h" className="sr-only">Pool reconciliation for {fmtMonth(latest.t)}</h2>
          <div className="equation">
            <div className="eq-term" style={{ "--sw": SERIES_COLORS.south } as React.CSSProperties}><small>Southern Pool</small><b>{fmtKm2(latest.s)} km²</b></div>
            <span className="eq-op" aria-label="plus">+</span>
            <div className="eq-term" style={{ "--sw": SERIES_COLORS.north } as React.CSSProperties}><small>Northern Pool</small><b>{fmtKm2(latest.n)} km²</b></div>
            <span className="eq-op" aria-label="equals">=</span>
            <div className="eq-term" style={{ "--sw": SERIES_COLORS.total } as React.CSSProperties}><small>Lake Total</small><b>{fmtKm2(latest.total)} km²</b></div>
          </div>
          <div className="shares" role="img" aria-label={`Share of lake total: Southern Pool ${sShare.toFixed(1)} percent, Northern Pool ${(100 - sShare).toFixed(1)} percent`}>
            <div style={{ width: `${sShare}%`, background: SERIES_COLORS.south }}>{sShare.toFixed(1)}%</div>
            <div style={{ width: `${100 - sShare}%`, background: SERIES_COLORS.north }}>{(100 - sShare).toFixed(1)}%</div>
          </div>
          <p className="chart-note" style={{ marginTop: 0 }}>
            Latest month with all three values: {fmtMonth(latest.t)}. Shares computed from the pool values. Reconciliation difference: {diff < 0.5 ? "none at the displayed precision" : `${fmtKm2(diff)} km²`}.
          </p>
        </section>
      )}
      <div className="panel">
        <div className="panel-head">
          <h2>Pools and lake total, monthly</h2>
          <div className="controls" role="group" aria-label="Show series">
            {DEF.filter((d) => pools[d.key].length).map((d) => (
              <button key={d.key} className="toggle" style={{ "--sw": d.color } as React.CSSProperties} aria-pressed={on[d.key]} onClick={() => setOn({ ...on, [d.key]: !on[d.key] })}><i />{d.label}</button>
            ))}
          </div>
        </div>
        {series.length ? <Chart series={series} height={420} ariaLabel="Monthly open-water extent of the Southern Pool, Northern Pool and lake total" /> : <p className="muted">Select at least one series.</p>}
        <Legend items={series.map((s) => ({ label: s.label, color: s.color }))} />
      </div>
    </>
  );
}

export default function Pools({ route }: { route: string }) {
  const pools = useEndpoint("pools");
  const trends = useEndpoint("trends");
  return (
    <div className="wrap">
      <PageHead eyebrow="Pool Intelligence" title="Two pools. A more complete picture.">
        The Southern and Northern Pools are analysed separately. Together they reconcile to the lake total.
      </PageHead>
      <Boundary state={pools} label="pool series" height={480} emptyText="No pool observations are available.">
        {(data) => { const p = readPools(data); return p ? <PoolsView pools={p} /> : null; }}
      </Boundary>
      <section style={{ marginTop: 56 }} aria-labelledby="ps-h">
        <h2 id="ps-h" className="h-section" style={{ marginBottom: 6 }}>Trend by pool</h2>
        <p className="muted" style={{ marginTop: 0, maxWidth: "60ch" }}>Statistical trend of each series, as reported by the analysis.</p>
        <Boundary state={trends} label="trend statistics" height={160} emptyText="No trend statistics are available.">
          {(data) => { const r = readTrends(data); return r.length ? <><TrendTable rows={r} /><TrendGlossary /></> : null; }}
        </Boundary>
      </section>
      <JourneyNav route={route} />
    </div>
  );
}
