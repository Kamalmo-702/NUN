import { useCallback, useEffect, useState } from "react";
import { apiConfigured, fetchEndpoint, peekEndpoint, type EndpointKey } from "../services/api";

export type EndpointState =
  | { status: "loading" }
  | { status: "unconfigured" }
  | { status: "error"; message: string }
  | { status: "ready"; data: unknown };

export function useEndpoint(key: EndpointKey): EndpointState & { reload: () => void } {
  const [state, setState] = useState<EndpointState>(() => {
    if (!apiConfigured) return { status: "unconfigured" };
    const hit = peekEndpoint(key);
    return hit !== undefined ? { status: "ready", data: hit } : { status: "loading" };
  });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!apiConfigured) return;
    let cancelled = false;
    if (nonce > 0 || peekEndpoint(key) === undefined) setState({ status: "loading" });
    fetchEndpoint(key, nonce > 0).then((res) => {
      if (cancelled) return;
      if (res.state === "VERIFIED") setState({ status: "ready", data: res.data });
      else setState({ status: "error", message: res.message ?? "The request failed." });
    });
    return () => {
      cancelled = true;
    };
  }, [key, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, reload };
}
