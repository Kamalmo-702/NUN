import { Boundary, Notice } from "../components/Boundary";
import { Chart } from "../components/Chart";
import { JourneyNav, PageHead } from "../components/Layout";
import { ArrowRight } from "../components/Icons";
import { useEndpoint } from "../hooks/useEndpoint";
import { FACTS, SERIES_COLORS } from "../lib/facts";
import { fmtKm2, fmtMonth, fmtNum, fmtP, readOverview, readSeries, readTrends } from "../lib/normalize";

const LINKS = [
  ["/history", "Water History", "The full monthly record with date controls."],
  ["/pools", "Pool Intelligence", "Northern and Southern Pools against the lake total."],
  ["/seasonal", "Seasonal Anomaly", "Observed extent against its seasonal pattern."],
  ["/forecast", "Forecast", "Validated first month and five recursive projections."],
] as const;

export default function Overview({ route }: { route: string }) {
  const overview = useEndpoint("overview");
  const series = useEndpoint("series");
  const trends = useEndpoint("trends");
  return (
    <div className="wrap">
      <PageHead eyebrow="Overview" title="Lake Chad at a glance">
        {FACTS.observations} monthly open-water observations, {FACTS.coverage}. A historical archive, last observation {FACTS.lastObservation}.
      </PageHead>

      <Boundary state={overview} label="overview" height={150} emptyText="The overview is unavailable.">
        {(data) => {
          const o = readOverview(data);
          if (!o?.latest || !Number.isFinite(o.latest.area)) return null;
          const signed = (n: number) => `${n > 0 ? "+" : ""}${fmtKm2(n)}`;
          return <dl className="metrics">
            <div className="metric"><dt>Last archived</dt><dd>{fmtKm2(o.latest.area)}<small>km²</small><span className="sub">{o.latest.date}</span></dd></div>
            <div className="metric"><dt>Month-over-month</dt><dd>{o.month && Number.isFinite(o.month.change) ? signed(o.month.change) : "—"}<small>km²</small><span className="sub">{o.month && Number.isFinite(o.month.pct) ? `${fmtNum(o.month.pct, 1)}%` : ""}</span></dd></div>
            <div className="metric"><dt>Holdout MAE</dt><dd>{o.model && Number.isFinite(o.model.mae) ? fmtKm2(o.model.mae) : "—"}<small>km²</small><span className="sub">{o.model?.name?.replace(/_/g, " ")}</span></dd></div>
            <div className="metric"><dt>Holdout R²</dt><dd>{o.model && Number.isFinite(o.model.r2) ? fmtNum(o.model.r2, 4) : "—"}<span className="sub">chronological test</span></dd></div>
          </dl>;
        }}
      </Boundary>

      <div style={{ marginTop: 28 }}>
      <Boundary state={series} label="historical series" height={420} emptyText="The historical series is empty.">
        {(data) => {
          const s = readSeries(data);
          if (!s) return null;
          const valid = s.points.filter((p) => Number.isFinite(p.v));
          if (!valid.length) return null;
          const last = valid[valid.length - 1];
          const hi = valid.reduce((a, b) => (b.v > a.v ? b : a));
          const lo = valid.reduce((a, b) => (b.v < a.v ? b : a));
          const mismatch = valid.length !== FACTS.observations;
          return (
            <>
              <dl className="metrics">
                <div className="metric"><dt>Observations</dt><dd>{FACTS.observations}<small>months</small></dd></div>
                <div className="metric"><dt>Latest archived</dt><dd>{fmtKm2(last.v)}<small>km²</small><span className="sub">{fmtMonth(last.t)}</span></dd></div>
                <div className="metric"><dt>Highest observation</dt><dd>{fmtKm2(hi.v)}<small>km²</small><span className="sub">{fmtMonth(hi.t)}</span></dd></div>
                <div className="metric"><dt>Lowest observation</dt><dd>{fmtKm2(lo.v)}<small>km²</small><span className="sub">{fmtMonth(lo.t)}</span></dd></div>
              </dl>
              {mismatch && <div style={{ marginTop: 16 }}><Notice tone="warn" title="Partial record">The API returned {valid.length} valid observations; the documented archive has {FACTS.observations}.</Notice></div>}
              <div className="panel" style={{ marginTop: 28 }}>
                <div className="panel-head">
                  <h2>Open-water extent, monthly</h2>
                  <a className="link" href="#/history">Explore the history <ArrowRight /></a>
                </div>
                <Chart series={[{ id: "total", label: "Open-water extent", color: SERIES_COLORS.total, points: s.points }]} height={340} ariaLabel="Monthly open-water extent of Lake Chad, 2001 to 2020" />
              </div>
            </>
          );
        }}
      </Boundary>
      </div>

      <div style={{ marginTop: 28 }}>
        <Boundary state={trends} label="trend" height={90} emptyText="No trend statistics are available.">
          {(data) => {
            const rows = readTrends(data);
            const r = rows.find((x) => /total|lake/i.test(x.name)) ?? rows[0];
            if (!r || (r.slope === undefined && r.tau === undefined)) return null;
            return (
              <div className="callout">
                <strong>Main historical signal</strong>
                {r.note ?? `Trend for ${r.name}`}. Sen's slope {fmtNum(r.slope, 2)}, Mann–Kendall τ {fmtNum(r.tau, 3)}, p {fmtP(r.p)}.
              </div>
            );
          }}
        </Boundary>
      </div>

      <section style={{ marginTop: 64 }} aria-labelledby="explore-h">
        <h2 id="explore-h" className="h-section" style={{ marginBottom: 16 }}>Explore further</h2>
        <ul className="index-list">
          {LINKS.map(([to, t, d]) => (
            <li key={to}><a href={`#${to}`}><strong>{t}</strong><span>{d}</span><ArrowRight /></a></li>
          ))}
        </ul>
      </section>
      <JourneyNav route={route} />
    </div>
  );
}
