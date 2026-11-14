/**
 * Centralised NUN API layer. All network access goes through here.
 * VITE_API_BASE_URL is optional: the production build is served by the FastAPI app and
 * therefore uses same-origin /api paths. Requests are de-duplicated and cached per
 * session; there is no polling (NUN is a historical archive, not live monitoring).
 */
export type DataState = "NO_DATA" | "PROCESSING" | "PREVIEW" | "VERIFIED" | "FAILED";

export interface ApiResult<T> {
  state: DataState;
  data?: T;
  message?: string;
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim().replace(/\/$/, "") ?? "";

export const apiConfigured = true;

export const ENDPOINTS = {
  health: "/api/health",
  overview: "/api/overview",
  series: "/api/series",
  pools: "/api/pools",
  trends: "/api/trends",
  seasonality: "/api/seasonality",
  anomalies: "/api/anomalies",
  forecast: "/api/forecast",
  evidence: "/api/evidence",
  discoveries: "/api/discoveries",
} as const;
export type EndpointKey = keyof typeof ENDPOINTS;

export async function apiRequest<T>(path: string, signal?: AbortSignal): Promise<ApiResult<T>> {
  if (!API_BASE_URL) {
    return {
      state: "NO_DATA",
      message: "The backend connection is not configured. Set VITE_API_BASE_URL.",
    };
  }
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return { state: "FAILED", message: `The data service returned HTTP ${response.status}.` };
    }
    try {
      return { state: "VERIFIED", data: (await response.json()) as T };
    } catch {
      return { state: "FAILED", message: "The data service returned a response that is not valid JSON." };
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return {
      state: "FAILED",
      message: "The data service could not be reached. Check the connection and try again.",
    };
  }
}

const cache = new Map<EndpointKey, Promise<ApiResult<unknown>>>();
const resolved = new Map<EndpointKey, unknown>();

/** Synchronously read an already-fetched payload (avoids loading flashes between pages). */
export const peekEndpoint = (key: EndpointKey): unknown => resolved.get(key);

/** Fetch once per session; concurrent callers share the same request. Failures are not cached. */
export function fetchEndpoint(key: EndpointKey, force = false): Promise<ApiResult<unknown>> {
  if (force) { cache.delete(key); resolved.delete(key); }
  let pending = cache.get(key);
  if (!pending) {
    pending = apiRequest<unknown>(ENDPOINTS[key]).then((res) => {
      if (res.state !== "VERIFIED") cache.delete(key);
      else resolved.set(key, res.data);
      return res;
    });
    cache.set(key, pending);
  }
  return pending;
}

export type DownloadOutcome = { ok: true } | { ok: false; message: string };

/** Fetches a backend file and hands it to the browser as a real download. */
export async function downloadFile(path: string, filename: string): Promise<DownloadOutcome> {
  if (!API_BASE_URL) return { ok: false, message: "Backend connection is not configured." };
  try {
    const response = await fetch(`${API_BASE_URL}${path}`);
    if (!response.ok) return { ok: false, message: `The data service returned HTTP ${response.status}.` };
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return { ok: true };
  } catch {
    return { ok: false, message: "The file could not be downloaded. Check the connection and try again." };
  }
}
