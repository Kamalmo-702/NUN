import { fmtNum, fmtP, type TrendRow } from "../lib/normalize";

export function TrendTable({ rows }: { rows: TrendRow[] }) {
  return (
    <div className="table-wrap">
      <table className="data">
        <caption className="sr-only">Trend statistics</caption>
        <thead>
          <tr><th scope="col">Series</th><th scope="col" className="n">Sen's slope</th><th scope="col" className="n">Mann–Kendall τ</th><th scope="col" className="n">p-value</th><th scope="col">Interpretation</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <th scope="row" style={{ color: "var(--text)", fontWeight: 600, fontSize: "0.9375rem" }}>{r.name}</th>
              <td className="n">{fmtNum(r.slope, 2)}{r.unit ? ` ${r.unit}` : ""}</td>
              <td className="n">{fmtNum(r.tau, 3)}</td>
              <td className="n">{fmtP(r.p)}</td>
              <td className="muted small">{r.note ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TrendGlossary() {
  return (
    <dl className="glossary">
      <div><dt>Sen's slope</dt><dd>The typical rate of change across the record, robust to outliers.</dd></div>
      <div><dt>Mann–Kendall τ</dt><dd>How consistently values rise or fall over time, from −1 to +1.</dd></div>
      <div><dt>p-value</dt><dd>How likely a pattern like this is by chance. A trend is not proof of cause.</dd></div>
    </dl>
  );
}
