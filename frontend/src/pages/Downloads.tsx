import { useState } from "react";
import { Notice } from "../components/Boundary";
import { Check, Download } from "../components/Icons";
import { JourneyNav, PageHead } from "../components/Layout";
import { DOWNLOADS } from "../lib/facts";
import { apiConfigured, downloadFile } from "../services/api";

type S = { s: "idle" | "busy" | "done" | "err"; msg?: string };

export default function Downloads({ route }: { route: string }) {
  const [st, setSt] = useState<Record<string, S>>({});
  const run = async (path: string, file: string) => {
    setSt((o) => ({ ...o, [file]: { s: "busy" } }));
    const r = await downloadFile(path, file);
    setSt((o) => ({ ...o, [file]: r.ok ? { s: "done" } : { s: "err", msg: r.message } }));
  };
  return (
    <div className="wrap">
      <PageHead eyebrow="Downloads" title="Explore the underlying results">
        The data and model outputs behind every chart, served directly by the NUN backend.
      </PageHead>
      {!apiConfigured && <div style={{ marginBottom: 24 }}><Notice tone="warn" title="Backend connection not configured">Downloads are unavailable until <code>VITE_API_BASE_URL</code> is set.</Notice></div>}
      <div>
        {DOWNLOADS.map((d) => {
          const s = st[d.file] ?? { s: "idle" };
          return (
            <div key={d.file} style={{ display: "contents" }}>
              <div className="dl-row">
                <div className="file-icon" aria-hidden="true">{d.type}</div>
                <div><h3>{d.title}</h3><p>{d.text}</p><p><code>{d.file}</code></p></div>
                <button className="btn ghost" disabled={!apiConfigured || s.s === "busy"} onClick={() => run(d.path, d.file)} aria-label={`Download ${d.file}`}>
                  {s.s === "done" ? <Check /> : <Download />} {s.s === "busy" ? "Downloading…" : s.s === "done" ? "Downloaded" : "Download"}
                </button>
              </div>
              {s.s === "err" && (
                <p className="dl-msg err" role="alert">{s.msg} <button className="link" style={{ background: "none", border: 0, cursor: "pointer", font: "inherit" }} onClick={() => run(d.path, d.file)}>Retry</button></p>
              )}
            </div>
          );
        })}
      </div>
      <p className="muted small" style={{ marginTop: 28, maxWidth: "62ch" }}>These files describe a historical archive ({`2001–2020`}), last observation May 2020. They are not live data.</p>
      <div className="ripple" style={{ marginTop: 48 }} aria-hidden="true" />
      <JourneyNav route={route} />
    </div>
  );
}
