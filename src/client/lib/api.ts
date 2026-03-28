/** Centralized API client — attaches X-User-Id header to all requests */

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

/** Typed fetch wrapper that auto-injects the user header */
export const apiFetch = async (path: string, options?: RequestInit) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> ?? {}),
  };
  if (currentUserId) {
    headers['x-user-id'] = currentUserId;
  }
  const res = await fetch(`/api${path}`, { ...options, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
};
