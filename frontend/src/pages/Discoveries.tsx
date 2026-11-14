import nut from "../assets/nut.webp";
import { Boundary } from "../components/Boundary";
import { JourneyNav, PageHead } from "../components/Layout";
import { useEndpoint } from "../hooks/useEndpoint";
import { fmtKm2, fmtNum, fmtP, readDiscoveries } from "../lib/normalize";

export default function Discoveries({ route }: { route: string }) {
  const d = useEndpoint("discoveries");
  return (
    <div className="wrap">
      <PageHead eyebrow="Discoveries" title="What the data reveals">
        Findings from the analysis of the historical record, as returned by the NUN backend.
      </PageHead>
      <div className="masthead">
        <img src={nut} alt="Egyptian painting of the sky goddess Nut arched over the earth, her body covered in stars." width={1100} height={807} loading="lazy" decoding="async" />
      </div>
      <Boundary state={d} label="discoveries" height={260} emptyText="No discoveries are available from the backend.">
        {(data) => {
          const rows = readDiscoveries(data);
          return rows.length ? (
            <div style={{ marginTop: 24 }}>
              {rows.map((r, i) => (
                <article className="discovery" key={i}>
                  <span className="idx" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <h2>{r.region ?? `Finding ${i + 1}`}</h2>
                    <p>{r.variable ?? "Open surface-water area"}</p>
                  </div>
                  <aside>
                    {Number.isFinite(r.slope) && <strong>{fmtNum(r.slope, 2)} km²/year</strong>}
                    {r.reliability && <span className="muted">{r.reliability}</span>}
                    <div className="kv">
                      {Number.isFinite(r.tau) && <span>τ: <b>{fmtNum(r.tau, 3)}</b></span>}
                      {Number.isFinite(r.p) && <span>p-value: <b>{fmtP(r.p)}</b></span>}
                      {r.date && <span>date: <b>{r.date}</b></span>}
                      {Number.isFinite(r.south) && <span>south: <b>{fmtKm2(r.south)} km²</b></span>}
                      {Number.isFinite(r.north) && <span>north: <b>{fmtKm2(r.north)} km²</b></span>}
                    </div>
                  </aside>
                </article>
              ))}
            </div>
          ) : null;
        }}
      </Boundary>
      <JourneyNav route={route} />
    </div>
  );
}
