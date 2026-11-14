import { useMemo, useState } from "react";
import hero from "../assets/nun-hero.webp";
import dendera from "../assets/dendera.webp";
import { Boundary } from "../components/Boundary";
import { Chart } from "../components/Chart";
import { ArrowRight } from "../components/Icons";
import { useEndpoint } from "../hooks/useEndpoint";
import { FACTS, SERIES_COLORS } from "../lib/facts";
import { fmtKm2, fmtMonth, readSeries } from "../lib/normalize";

function OneNumber() {
  const state = useEndpoint("series");
  return (
    <Boundary state={state} label="series" height={260} emptyText="The historical series is empty, so the comparison cannot be drawn.">
      {(data) => {
        const s = readSeries(data);
        return s ? <Pick points={s.points} /> : null;
      }}
    </Boundary>
  );
}

function Pick({ points }: { points: { t: number; v: number }[] }) {
  const [i, setI] = useState(Math.floor(points.length / 2));
  const idx = Math.min(i, points.length - 1);
  const p = points[idx];
  const series = useMemo(
    () => [
      { id: "all", label: "Open-water extent", color: SERIES_COLORS.total, points, width: 1.8 },
      { id: "one", label: "Selected month", color: "var(--gold)", points: [p], markers: "filled" as const },
    ],
    [points, p],
  );
  return (
    <div className="panel">
      <Chart series={series} height={260} ariaLabel="Open-water extent over time with one selected month highlighted" />
      <div className="single-month">
        <label htmlFor="pick" className="small muted">Select a single month</label>
        <input id="pick" type="range" min={0} max={points.length - 1} value={idx} onChange={(e) => setI(Number(e.target.value))} aria-valuetext={fmtMonth(p.t)} />
        <output htmlFor="pick"><span className="num">{fmtKm2(p.v)} km²</span> <span className="muted small">in {fmtMonth(p.t)}</span></output>
      </div>
      <p className="chart-note">One month shows a level. Only the full record shows direction, season and recovery.</p>
    </div>
  );
}

const STAGES = [
  ["Historical observations", "233 monthly open-water extents, 2001–2020.", "/history"],
  ["Temporal analysis", "Long-term trend with Sen's slope and Mann–Kendall.", "/history"],
  ["Pool intelligence", "Southern and Northern Pools reconciled to the lake total.", "/pools"],
  ["Seasonal analysis", "Observed extent compared with its seasonal pattern.", "/seasonal"],
  ["Forecast & evaluation", "Random Forest, tested on 29 unseen months.", "/forecast"],
  ["Evidence & discoveries", "Sources, limitations and findings, with downloads.", "/evidence"],
] as const;

export default function Story() {
  return (
    <>
      <section className="hero" aria-labelledby="h1">
        <img src={hero} alt="Illustration of Nun, the primordial waters: a golden mound inscribed NUN rising from dark water beneath a field of stars, flanked by two winged figures." width={1400} height={917} fetchPriority="high" decoding="async" />
        <span className="credit">Supplied reference artwork</span>
        <div className="wrap">
          <span className="eyebrow">Lake Chad Water Intelligence</span>
          <h1 id="h1" className="display">The first water, read through time.</h1>
          <p className="lede">
            In Egyptian cosmology, Nun is the primordial water from which everything began. NUN reads Lake Chad's water through {FACTS.observations} monthly satellite-derived observations, {FACTS.coverage}.
          </p>
          <div className="hero-actions">
            <a className="btn primary" href="#/overview">Enter the platform <ArrowRight /></a>
            <a className="btn ghost" href="#why">Why one number is not enough</a>
          </div>
          <div className="hero-meta">
            <span><b>{FACTS.observations}</b> monthly observations</span>
            <span><b>{FACTS.coverage}</b> historical coverage</span>
            <span>Last archived: <b>{FACTS.lastObservation}</b></span>
            <span>Archive, not live monitoring</span>
          </div>
        </div>
      </section>

      <section className="section" id="why" aria-labelledby="why-h">
        <div className="wrap split">
          <div>
            <span className="eyebrow">The human question</span>
            <h2 id="why-h" className="h-section h-serif" style={{ margin: "14px 0 0" }}>A changing lake changes daily decisions.</h2>
            <p className="lede" style={{ marginTop: 16 }}>Imagine planning seasonal water use with one number: Lake Chad is a certain size today. That number alone cannot tell you whether the level is normal for this month, whether change is concentrated in one pool, or whether the pattern is statistically meaningful.</p>
            <ol className="statements">
              <li>Is the latest water extent normal for this season?</li>
              <li>Where is the change happening: North, South, or both?</li>
              <li>How much changed, and is the trend statistically meaningful?</li>
            </ol>
            <figure className="figure" style={{ marginTop: 32 }}>
              <img src={dendera} alt="Painted ceiling of the Dendera temple with a circular star chart on a deep blue ground." width={1100} height={574} loading="lazy" decoding="async" />
              <figcaption>Dendera temple ceiling: Egyptian observers also recorded cycles across time.</figcaption>
            </figure>
          </div>
          <OneNumber />
        </div>
      </section>

      <section className="section alt" aria-labelledby="sys-h">
        <div className="wrap">
          <span className="eyebrow">The system</span>
          <h2 id="sys-h" className="h-section" style={{ margin: "14px 0 8px", maxWidth: "24ch" }}>From historical observations to understandable intelligence</h2>
          <p className="lede">NUN does not display satellite images. It analyses the archived record of open-water extent.</p>
          <ol className="pipeline">
            {STAGES.map(([t, d, to], i) => (
              <li key={t} className={i === STAGES.length - 1 ? "last" : ""}>
                <a href={`#${to}`}>
                  <span className="step">{i + 1}</span>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </a>
              </li>
            ))}
          </ol>
          <div className="diff">
            <div><h3>Historical perspective</h3><p>{FACTS.observations} months across {FACTS.coverage}, with the last observation in {FACTS.lastObservation}.</p></div>
            <div><h3>Beyond a single number</h3><p>Northern and Southern Pools are read separately and reconciled to the lake total.</p></div>
            <div><h3>Transparent evaluation</h3><p>The forecast model is tested on {FACTS.holdoutMonths} unseen months, with its limits stated.</p></div>
          </div>
          <div style={{ marginTop: 48 }}>
            <a className="btn primary" href="#/overview">Open the overview <ArrowRight /></a>
          </div>
        </div>
      </section>
    </>
  );
}
