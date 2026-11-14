import { Boundary } from "../components/Boundary";
import { Chart, Legend } from "../components/Chart";
import { JourneyNav, PageHead } from "../components/Layout";
import { useEndpoint } from "../hooks/useEndpoint";
import { SERIES_COLORS } from "../lib/facts";
import { extractRows, findKey, numericKeys, parseDate, readSeries, toNum, type Point } from "../lib/normalize";

const MON = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function readSeason(payload: unknown): { points: Point[]; key: string } | null {
  const rows = extractRows(payload);
  if (!rows.length) return null;
  const mk = findKey(rows[0], /month/i) ?? findKey(rows[0], /^(date|period)/i);
  if (!mk) return null;
  const vk = numericKeys(rows, mk).find((k) => /mean|expect|clim|season|avg|median|value/i.test(k)) ?? numericKeys(rows, mk)[0];
  if (!vk) return null;
  const pts = rows.map((r) => {
    const raw = r[mk];
    let m = toNum(raw);
    if (Number.isNaN(m) && typeof raw === "string") {
      const idx = MON.indexOf(raw.trim().slice(0, 3).toLowerCase());
      m = idx >= 0 ? idx + 1 : (() => { const t = parseDate(raw); return Number.isNaN(t) ? NaN : new Date(t).getUTCMonth() + 1; })();
    }
    return { t: Date.UTC(2001, m - 1, 1), v: toNum(r[vk]) };
  }).filter((p) => !Number.isNaN(p.t) && new Date(p.t).getUTCFullYear() === 2001).sort((a, b) => a.t - b.t);
  return pts.length ? { points: pts, key: vk } : null;
}

export default function Seasonal({ route }: { route: string }) {
  const season = useEndpoint("seasonality");
  const anom = useEndpoint("anomalies");
  return (
    <div className="wrap">
      <PageHead eyebrow="Seasonal Anomaly" title="Understanding the seasonal signal">
        Lake Chad's open water follows a seasonal rhythm. An anomaly shows how a month departs from it.
      </PageHead>
      <div className="callout" style={{ marginBottom: 32 }}>
        <strong>A relative signal, not a drought diagnosis</strong>
        Anomalies compare open-water extent with its own seasonal pattern. They are not confirmed meteorological drought and do not identify rainfall as a cause.
      </div>

      <div className="panel">
        <div className="panel-head"><h2>Expected seasonal pattern</h2></div>
        <Boundary state={season} label="seasonal pattern" height={300} emptyText="No seasonal pattern is available.">
          {(data) => {
            const s = readSeason(data);
            if (!s) return null;
            return (
              <>
                <Chart series={[{ id: "season", label: "Expected extent", color: SERIES_COLORS.evidence, points: s.points, markers: "filled" }]} height={300} monthsOnly yTitle="Expected open-water extent (km²)" ariaLabel="Expected open-water extent for each calendar month" />
                <p className="chart-note">Plotted field: {s.key.replace(/_/g, " ")}, by calendar month.</p>
              </>
            );
          }}
        </Boundary>
      </div>

      <div className="panel" style={{ marginTop: 28 }}>
        <div className="panel-head"><h2>Observed departure from the seasonal pattern</h2></div>
        <Boundary state={anom} label="anomalies" height={360} emptyText="No anomaly values are available.">
          {(data) => {
            const s = readSeries(data, /anomal|deviat|resid|diff|^z/i);
            if (!s) return null;
            const unit = /km/i.test(s.valueKey) ? "km²" : "";
            return (
              <>
                <Chart unit={unit} yTitle={unit ? "Anomaly (km²)" : "Anomaly (as reported)"} zero series={[{ id: "an", label: "Anomaly", kind: "bar", color: SERIES_COLORS.total, negativeColor: SERIES_COLORS.decrease, points: s.points }]} height={360} ariaLabel="Monthly open-water anomaly relative to the seasonal pattern" />
                <Legend items={[{ label: "Above seasonal pattern", color: SERIES_COLORS.total, style: "bar" }, { label: "Below seasonal pattern", color: SERIES_COLORS.decrease, style: "bar" }]} />
                <p className="chart-note">Plotted field: {s.valueKey.replace(/_/g, " ")}. Bars show departure from expected extent for that month.</p>
              </>
            );
          }}
        </Boundary>
      </div>
      <JourneyNav route={route} />
    </div>
  );
}
