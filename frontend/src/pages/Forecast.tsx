import { useMemo } from "react";
import { Boundary, Notice } from "../components/Boundary";
import { Chart, Legend } from "../components/Chart";
import { JourneyNav, PageHead } from "../components/Layout";
import { useEndpoint } from "../hooks/useEndpoint";
import { FACTS, SERIES_COLORS } from "../lib/facts";
import { fmtKm2, fmtMonth, readForecast, readSeries, type ForecastRead } from "../lib/normalize";

function View({ fc, fallbackHistory }: { fc: ForecastRead; fallbackHistory: { t: number; v: number }[] }) {
  const history = fc.history.length ? fc.history : fallbackHistory;
  // Project convention: first forecast month is the validated one; the rest are recursive.
  const forecast = fc.forecast;
  const first = forecast[0];
  const rest = forecast.slice(1);
  const recent = useMemo(() => history.filter((p) => Number.isFinite(p.v)).slice(-48), [history]);
  const series = useMemo(() => {
    const out = [{ id: "hist", label: "Historical observations", color: SERIES_COLORS.total, points: recent }];
    const lastHist = recent[recent.length - 1];
    if (first) {
      out.push({ id: "val", label: "Validated first forecast month", color: SERIES_COLORS.forecast, points: [...(lastHist ? [{ ...lastHist, anchor: true }] : []), first], markers: "filled", width: 2 } as never);
      if (rest.length) out.push({ id: "rec", label: "Recursive projections", color: SERIES_COLORS.forecast, dashed: true, markers: "hollow", points: [{ ...first, anchor: true }, ...rest] } as never);
    }
    return out;
  }, [recent, first, rest]);
  const bands = first ? [{ from: first.t - 1.3e9, to: forecast[forecast.length - 1].t, label: "Forecast horizon" }] : undefined;
  return (
    <div className="fc-layout">
      <div>
        {fc.missing.length > 0 && <div style={{ marginBottom: 16 }}><Notice tone="warn" title="Partial data">Missing from the response: {fc.missing.join(", ")}.</Notice></div>}
        {!fc.history.length && <div style={{ marginBottom: 16 }}><Notice title="Historical context">The forecast response has no history, so the observed series is shown for context.</Notice></div>}
        <div className="panel">
          <div className="panel-head"><h2>Observations and forecast</h2></div>
          <Chart series={series} bands={bands} height={420} ariaLabel="Historical open-water extent followed by one validated forecast month and recursive projections" />
          <Legend items={[
            { label: "Historical observations", color: SERIES_COLORS.total },
            { label: "Validated first month", color: SERIES_COLORS.forecast, style: "filled" },
            { label: `${FACTS.recursiveMonths} recursive projections`, color: SERIES_COLORS.forecast, style: "hollow" },
          ]} />
          <p className="chart-note">Showing the most recent 48 months of the record. Recursive projections feed on earlier predictions, so they are less certain than the first month.</p>
        </div>
        {forecast.length > 0 && (
          <div className="table-wrap panel" style={{ marginTop: 24 }}>
            <table className="data">
              <caption className="sr-only">Forecast values</caption>
              <thead><tr><th scope="col">Month</th><th scope="col" className="n">Forecast (km²)</th><th scope="col">Status</th></tr></thead>
              <tbody>
                {forecast.map((p, i) => (
                  <tr key={p.t}>
                    <th scope="row" style={{ fontWeight: 500, color: "var(--text)", fontSize: "0.9375rem" }}>{fmtMonth(p.t)}</th>
                    <td className="n">{fmtKm2(p.v)}</td>
                    <td>{i === 0 ? <span className="tag ok">Validated</span> : <span className="tag proj">Recursive projection {i}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <aside className="eval panel" aria-labelledby="eval-h">
        <h2 id="eval-h" style={{ fontSize: "1.0625rem" }}>Model evaluation</h2>
        <p className="small muted" style={{ margin: "4px 0 8px" }}>{FACTS.model}, chronological holdout of {FACTS.holdoutMonths} unseen months.</p>
        <dl>
          <div><dt>MAE</dt><dd>{FACTS.mae} <small>km²</small></dd><p>Average size of the error.</p></div>
          <div><dt>RMSE</dt><dd>{FACTS.rmse} <small>km²</small></dd><p>Error measure that weights large misses more.</p></div>
          <div><dt>R²</dt><dd>{FACTS.r2}</dd><p>Share of variation explained, unitless. 1 is a perfect fit.</p></div>
        </dl>
      </aside>
    </div>
  );
}

export default function Forecast({ route }: { route: string }) {
  const fc = useEndpoint("forecast");
  const series = useEndpoint("series");
  return (
    <div className="wrap">
      <PageHead eyebrow="Forecast" title="Looking beyond the historical record">
        One forecast month is validated against held-out data. The five months after it are recursive projections.
      </PageHead>
      <Boundary state={fc} label="forecast" height={460} emptyText="No forecast values are available.">
        {(data) => {
          const r = readForecast(data);
          if (!r || !r.forecast.length) return null;
          const fallback = series.status === "ready" ? readSeries(series.data)?.points ?? [] : [];
          return <View fc={r} fallbackHistory={fallback} />;
        }}
      </Boundary>
      <JourneyNav route={route} />
    </div>
  );
}
