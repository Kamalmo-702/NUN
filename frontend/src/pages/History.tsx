import { useMemo, useState } from "react";
import { Boundary } from "../components/Boundary";
import { Chart } from "../components/Chart";
import { JourneyNav, PageHead } from "../components/Layout";
import { TrendGlossary, TrendTable } from "../components/TrendStats";
import { useEndpoint } from "../hooks/useEndpoint";
import { SERIES_COLORS } from "../lib/facts";
import { fmtKm2, fmtMonth, fmtYear, readSeries, readTrends, type Point } from "../lib/normalize";

function Explorer({ points }: { points: Point[] }) {
  const years = useMemo(() => Array.from(new Set(points.map((p) => fmtYear(p.t)))), [points]);
  const [from, setFrom] = useState(years[0]);
  const [to, setTo] = useState(years[years.length - 1]);
  const lo = Math.min(from, to), hi = Math.max(from, to);
  const view = useMemo(() => points.filter((p) => fmtYear(p.t) >= lo && fmtYear(p.t) <= hi), [points, lo, hi]);
  const valid = view.filter((p) => Number.isFinite(p.v));
  const series = useMemo(() => [{ id: "total", label: "Open-water extent", color: SERIES_COLORS.total, points: view }], [view]);
  const max = valid.length ? valid.reduce((a, b) => (b.v > a.v ? b : a)) : null;
  const min = valid.length ? valid.reduce((a, b) => (b.v < a.v ? b : a)) : null;
  const full = lo === years[0] && hi === years[years.length - 1];
  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Open-water extent, monthly</h2>
        <div className="controls">
          <label className="field">From
            <select value={from} onChange={(e) => setFrom(Number(e.target.value))}>{years.map((y) => <option key={y}>{y}</option>)}</select>
          </label>
          <label className="field">To
            <select value={to} onChange={(e) => setTo(Number(e.target.value))}>{years.map((y) => <option key={y}>{y}</option>)}</select>
          </label>
          <button className="btn ghost" style={{ minHeight: 40, padding: "0 14px" }} disabled={full} onClick={() => { setFrom(years[0]); setTo(years[years.length - 1]); }}>Reset</button>
        </div>
      </div>
      {valid.length ? (
        <>
          <Chart series={series} height={460} ariaLabel={`Monthly open-water extent of Lake Chad, ${lo} to ${hi}`} />
          <p className="chart-note">
            {valid.length} observations, {lo}–{hi}. Highest {fmtKm2(max!.v)} km² ({fmtMonth(max!.t)}); lowest {fmtKm2(min!.v)} km² ({fmtMonth(min!.t)}). Hover or use arrow keys to read values.
          </p>
        </>
      ) : <p className="muted">No observations in the selected range.</p>}
    </div>
  );
}

export default function History({ route }: { route: string }) {
  const series = useEndpoint("series");
  const trends = useEndpoint("trends");
  return (
    <div className="wrap">
      <PageHead eyebrow="Water History" title="Understanding change through time">
        The monthly open-water extent of Lake Chad, in km². Narrow the period to read a specific stretch.
      </PageHead>
      <Boundary state={series} label="historical series" height={520} emptyText="The historical series is empty.">
        {(data) => {
          const s = readSeries(data);
          return s ? <Explorer points={s.points} /> : null;
        }}
      </Boundary>
      <section style={{ marginTop: 56 }} aria-labelledby="trend-h">
        <h2 id="trend-h" className="h-section" style={{ marginBottom: 6 }}>Long-term trend</h2>
        <p className="muted" style={{ marginTop: 0, maxWidth: "60ch" }}>Statistical trend of the full record. A trend describes direction; it does not explain cause.</p>
        <Boundary state={trends} label="trend statistics" height={140} emptyText="No trend statistics are available.">
          {(data) => {
            const rows = readTrends(data);
            const total = rows.filter((r) => /total|lake/i.test(r.name));
            const use = total.length ? total : rows;
            return use.length ? <><TrendTable rows={use} /><TrendGlossary /></> : null;
          }}
        </Boundary>
      </section>
      <JourneyNav route={route} />
    </div>
  );
}
