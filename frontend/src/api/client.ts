/**
 * API 베이스 URL.
 * - 시놀로지 역프록시(mem.photos): 상대 경로('') 우선 → 같은 origin으로 요청해 CORS/loopback 차단 방지.
 * - 환경 변수 VITE_API_BASE_URL이 비어 있지 않으면 사용 (로컬 개발).
 * - 로컬: 기본값 http://localhost:8006 (또는 env).
 */
function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    // localhost/127.0.0.1: VITE_API_BASE_URL 환경변수 또는 기본값 사용
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      const envUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
      return envUrl !== undefined && envUrl !== "" ? envUrl : "";
    }
    // 외부 도메인(역프록시 경유): 상대경로 사용 → Vite 프록시가 /api → backend:8000 전달
    return "";
  }
  return "";
}

const apiBaseUrl = getApiBaseUrl();

type RequestOptions = {
  token?: string | null;
  cache?: RequestCache;
};

const buildHeaders = (token?: string | null) => {
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

const parseErrorResponse = async (response: Response): Promise<string> => {
  const text = await response.text();
  try {
    const json = JSON.parse(text);
    if (json.detail) {
      return json.detail;
    }
    return text;
  } catch {
    return text || `HTTP ${response.status}: ${response.statusText}`;
  }
};

const handleError = async (response: Response): Promise<never> => {
  const errorMessage = await parseErrorResponse(response);
  const error = new Error(errorMessage);
  (error as any).status = response.status;
  (error as any).isTokenExpired = response.status === 401 && errorMessage.includes("token expired");
  throw error;
};

export const apiGet = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: buildHeaders(options.token),
    cache: options.cache ?? "default",
  });
  if (!response.ok) {
    await handleError(response);
  }
  return response.json() as Promise<T>;
};

export const apiPost = async <T, P>(path: string, payload: P, options: RequestOptions = {}): Promise<T> => {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...buildHeaders(options.token) },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    await handleError(response);
  }
  return response.json() as Promise<T>;
};

export const apiPatch = async <T, P>(path: string, payload: P, options: RequestOptions = {}): Promise<T> => {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...buildHeaders(options.token) },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    await handleError(response);
  }
  return response.json() as Promise<T>;
};

export const apiPut = async <T, P>(path: string, payload: P, options: RequestOptions = {}): Promise<T> => {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...buildHeaders(options.token) },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    await handleError(response);
  }
  return response.json() as Promise<T>;
};

export const apiDelete = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "DELETE",
    headers: buildHeaders(options.token),
  });
  if (!response.ok) {
    await handleError(response);
  }
  return response.json() as Promise<T>;
};
