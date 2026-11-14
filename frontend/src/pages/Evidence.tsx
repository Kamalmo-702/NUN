import { Boundary } from "../components/Boundary";
import { JourneyNav, PageHead } from "../components/Layout";
import { useEndpoint } from "../hooks/useEndpoint";
import { FACTS } from "../lib/facts";
import { readEvidence } from "../lib/normalize";

const METHODS = [
  "Long-term trend: Sen's slope and the Mann–Kendall test.",
  "Pool Intelligence: Southern Pool + Northern Pool = reconciled Lake Total.",
  "Seasonal anomaly: observed extent compared with the expected seasonal pattern.",
  `Forecast: ${FACTS.model}, evaluated on a chronological holdout of ${FACTS.holdoutMonths} unseen months.`,
];
const LIMITS = [
  "A historical archive, not live monitoring. The last archived observation is " + FACTS.lastObservation + ".",
  "The seasonal anomaly is a relative open-water signal, not a meteorological drought diagnosis.",
  "Only the first forecast month is validated. The next five months are recursive projections.",
  "Trend statistics describe direction. They do not establish cause.",
  "The platform does not provide pixel-level water mapping or rainfall attribution.",
];

export default function Evidence({ route }: { route: string }) {
  const ev = useEndpoint("evidence");
  return (
    <div className="wrap">
      <PageHead eyebrow="Evidence & Trust" title="Show the evidence behind the intelligence">
        What NUN is built on, how it was tested, and where its limits are.
      </PageHead>

      <section className="ev-grid" aria-labelledby="e1"><h2 id="e1">Data</h2>
        <div><ul className="plain-list">
          <li>{FACTS.observations} monthly satellite-derived open-water observations of Lake Chad.</li>
          <li>Historical coverage {FACTS.coverage}; last archived observation {FACTS.lastObservation}.</li>
        </ul></div>
      </section>
      <section className="ev-grid" aria-labelledby="e2"><h2 id="e2">Methodology</h2>
        <div><ul className="plain-list">{METHODS.map((m) => <li key={m}>{m}</li>)}</ul></div>
      </section>
      <section className="ev-grid" aria-labelledby="e3"><h2 id="e3">Model evaluation</h2>
        <div>
          <dl className="metrics" style={{ borderBottom: 0, borderTop: 0 }}>
            <div className="metric" style={{ paddingLeft: 0 }}><dt>MAE</dt><dd>{FACTS.mae}<small>km²</small></dd></div>
            <div className="metric"><dt>RMSE</dt><dd>{FACTS.rmse}<small>km²</small></dd></div>
            <div className="metric"><dt>R²</dt><dd>{FACTS.r2}</dd></div>
          </dl>
          <p className="muted small" style={{ maxWidth: "62ch" }}>Computed on a chronological holdout of {FACTS.holdoutMonths} unseen months. The first forecast month is validated; the following five are recursive projections.</p>
        </div>
      </section>
      <section className="ev-grid" aria-labelledby="e4"><h2 id="e4">Evidence records</h2>
        <div>
          <Boundary state={ev} label="evidence records" height={160} emptyText="No evidence records are available from the backend.">
            {(data) => {
              const record = readEvidence(data);
              return record ? <article className="record">
                <h3>Verified source and coverage</h3>
                <p>{record.citation ?? "Source citation not supplied by the backend."}</p>
                <div className="kv">
                  {record.license && <span>license: <b>{record.license}</b></span>}
                  {record.start && record.end && <span>coverage: <b>{record.start} to {record.end}</b></span>}
                  {Number.isFinite(record.observations) && <span>observations: <b>{record.observations}</b></span>}
                  {record.units && <span>units: <b>{record.units}</b></span>}
                </div>
                {record.capabilities.length > 0 && <p className="small muted">Supported: {record.capabilities.join(" • ")}</p>}
                {record.exclusions.length > 0 && <p className="small muted">Outside current scope: {record.exclusions.join(" • ")}</p>}
              </article> : null;
            }}
          </Boundary>
        </div>
      </section>
      <section className="ev-grid" aria-labelledby="e5"><h2 id="e5">Limitations</h2>
        <div><ul className="plain-list">{LIMITS.map((m) => <li key={m}>{m}</li>)}</ul></div>
      </section>
      <JourneyNav route={route} />
    </div>
  );
}
