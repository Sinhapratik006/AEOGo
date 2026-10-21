export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly field?: string,
    readonly data: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** JSON request to our own API. Throws ApiError with the server's message on failure. */
export async function api<T = Record<string, unknown>>(
  path: string,
  options: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: options.method ?? "POST",
      headers: options.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new ApiError("Network error. Check your connection and try again.", "NETWORK_ERROR", 0);
  }

  let data: Record<string, unknown> | null = null;
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    // Non-JSON response (e.g. a proxy error page).
  }
  if (!res.ok) {
    const error = (data?.error ?? {}) as Record<string, unknown>;
    if (res.status === 401 && typeof window !== "undefined") {
      // The session expired: a full page load clears client-cached pages from the old session.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    }
    throw new ApiError(
      typeof error.message === "string" ? error.message : `Request failed (${res.status}). Please try again.`,
      typeof error.code === "string" ? error.code : "REQUEST_FAILED",
      res.status,
      typeof error.field === "string" ? error.field : undefined,
      error,
    );
  }
  return (data ?? {}) as T;
}

export function errorMessage(err: unknown): string {
  return err instanceof Error && err.message ? err.message : "Something went wrong. Please try again.";
}
