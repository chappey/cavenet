/** Centralized API client — attaches X-User-Id header to all requests */

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

let currentUserId: string | null = localStorage.getItem('cavenet_user_id');

export const setCurrentUserId = (id: string | null) => {
  currentUserId = id;
  if (id) {
    localStorage.setItem('cavenet_user_id', id);
  } else {
    localStorage.removeItem('cavenet_user_id');
  }
};

export const getCurrentUserId = () => currentUserId;

const parseErrorBody = async (res: Response) => {
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      const payload = await res.json() as { message?: string; code?: string };
      return { message: payload.message || res.statusText || 'Request failed', code: payload.code };
    } catch {
      return { message: res.statusText || 'Request failed' };
    }
  }

  const text = await res.text();
  return { message: text.trim() || res.statusText || 'Request failed' };
};

/**
 * Typed fetch wrapper that auto-injects the user header and handles retries
 * on network failures or server errors.
 */
export const apiFetch = async <T = unknown>(path: string, options?: RequestInit, retries = 3): Promise<T> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> ?? {}),
  };

  if (currentUserId) {
    headers['x-user-id'] = currentUserId;
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`/api${path}`, { ...options, headers });

      if (!res.ok) {
        const error = await parseErrorBody(res);
        throw new ApiError(error.message, res.status, error.code);
      }

      if (res.status === 204) {
        return undefined as T;
      }

      return await res.json() as T;
    } catch (err: any) {
      lastError = err;

      // Don't retry on client errors (logic errors)
      if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
        throw err;
      }

      if (attempt < retries) {
        const delay = 300 * Math.pow(2, attempt);
        console.warn(`[apiFetch] Attempt ${attempt + 1} failed for ${path}. Retrying in ${delay}ms...`, err);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error(`Failed to fetch ${path} after ${retries} retries`);
};
