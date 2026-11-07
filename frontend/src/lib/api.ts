import { useAuth } from "@/store";

export const MOCK = import.meta.env.VITE_MOCK === "true";

/** Error thrown for non-2xx responses; carries the Persian ProblemDetails title and field errors. */
export class ApiError extends Error {
  status: number;
  errors: Record<string, string[]>;
  constructor(status: number, message: string, errors: Record<string, string[]> = {}) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
  field(name: string) {
    return this.errors[name]?.[0];
  }
}

type Method = "GET" | "POST" | "PUT" | "DELETE";
type Query = Record<string, string | number | boolean | null | undefined>;

export function qs(q?: Query) {
  if (!q) return "";
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}

let mockHandler: ((method: Method, path: string, body: unknown) => Promise<unknown>) | null = null;

async function request<T>(method: Method, path: string, body?: unknown, raw = false): Promise<T> {
  if (MOCK) {
    const handler = mockHandler ?? (mockHandler = (await import("@/mocks/handlers")).handle);
    return (await handler(method, path, body)) as T;
  }
  const { token, workspaceId } = useAuth.getState();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (workspaceId) headers["X-Workspace-Id"] = workspaceId;
  let payload: BodyInit | undefined;
  if (body !== undefined) {
    if (typeof body === "string") {
      headers["Content-Type"] = "text/plain; charset=utf-8";
      payload = body;
    } else {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }
  }

  let res: Response;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: payload });
  } catch {
    throw new ApiError(0, "ارتباط با سرور برقرار نشد. اتصال اینترنت یا وضعیت سرور را بررسی کنید.");
  }

  if (res.status === 401 && token) {
    useAuth.getState().logout();
    if (!location.pathname.startsWith("/login")) location.assign("/login?expired=1");
  }
  if (!res.ok) {
    let title = "درخواست انجام نشد.";
    let errors: Record<string, string[]> = {};
    try {
      const pd = await res.json();
      title = pd.title ?? title;
      errors = pd.errors ?? {};
    } catch {
      /* not json */
    }
    throw new ApiError(res.status, title, errors);
  }
  if (raw) return (await res.blob()) as T;
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  get: <T>(path: string, q?: Query) => request<T>("GET", path + qs(q)),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {}),
  put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),
  del: (path: string) => request<void>("DELETE", path),
  blob: (path: string, q?: Query) => request<Blob>("GET", path + qs(q), undefined, true),
};

export async function downloadCsv(path: string, q: Query, filename: string) {
  const blob = await api.blob(path, q);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
