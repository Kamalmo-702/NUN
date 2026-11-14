import type { ReactNode } from "react";
import type { EndpointState } from "../hooks/useEndpoint";

type Props = {
  state: EndpointState & { reload: () => void };
  /** Return null when the payload was received but is empty/unreadable. */
  children: (data: unknown) => ReactNode | null;
  emptyText?: string;
  height?: number;
  label?: string;
};

export function Notice({ tone = "neutral", title, children, action }: { tone?: "neutral" | "error" | "warn"; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className={`notice ${tone}`} role={tone === "error" ? "alert" : "status"}>
      <div>
        <strong>{title}</strong>
        {children && <p>{children}</p>}
      </div>
      {action}
    </div>
  );
}

/** Handles loading, configuration-missing, error and empty states for one endpoint. */
export function Boundary({ state, children, emptyText = "No data is currently available for this section.", height = 280, label = "data" }: Props) {
  if (state.status === "loading")
    return <div className="skeleton" style={{ height }} role="status" aria-label={`Loading ${label}`}><span /></div>;
  if (state.status === "unconfigured")
    return (
      <Notice tone="warn" title="Backend connection not configured">
        Set <code>VITE_API_BASE_URL</code> to the NUN API address and rebuild. No values are shown until real data is available.
      </Notice>
    );
  if (state.status === "error")
    return (
      <Notice tone="error" title={`The ${label} could not be loaded`} action={<button className="btn ghost" onClick={state.reload}>Retry</button>}>
        {state.message}
      </Notice>
    );
  const out = children(state.data);
  if (out === null) return <Notice title="No data available">{emptyText}</Notice>;
  return <>{out}</>;
}
