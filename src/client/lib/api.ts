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

/** 
 * Typed fetch wrapper that auto-injects the user header and handles retries 
 * on network failures or server errors.
 */
export const apiFetch = async (path: string, options?: RequestInit, retries = 3): Promise<any> => {
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
        // If it's a 4xx error (client error), don't retry, just throw
        if (res.status >= 400 && res.status < 500) {
          const text = await res.text();
          throw new Error(text || res.statusText);
        }
        // If it's a 5xx error (server error), we can retry
        throw new Error(`Server Error (${res.status})`);
      }
      
      return await res.json();
    } catch (err: any) {
      lastError = err;
      
      // Don't retry on client errors (logic errors)
      if (err.message && (err.message.includes('400') || err.message.includes('401') || err.message.includes('403') || err.message.includes('404'))) {
        throw err;
      }

      if (attempt < retries) {
        const delay = 300 * Math.pow(2, attempt); // Simple exponential backoff: 300ms, 600ms, 1200ms
        console.warn(`[apiFetch] Attempt ${attempt + 1} failed for ${path}. Retrying in ${delay}ms...`, err);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error(`Failed to fetch ${path} after ${retries} retries`);
};
