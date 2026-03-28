import { treaty } from '@elysiajs/eden';
import type { App } from '../../server/index';

let currentUserId: string | null = localStorage.getItem('cavenet_user_id');

const client = treaty<App>(window.location.origin);

/** Wrap eden client to inject X-User-Id header on every request */
const createApiProxy = () => {
  const handler: ProxyHandler<any> = {
    get(target, prop) {
      const value = target[prop];
      if (typeof value === 'function') {
        return (...args: any[]) => {
          // For .get(), .post(), etc., inject headers
          const lastArg = args[args.length - 1];
          if (typeof lastArg === 'object' && lastArg !== null && !Array.isArray(lastArg)) {
            // Merge headers into existing options
            lastArg.headers = {
              ...lastArg.headers,
              ...(currentUserId ? { 'x-user-id': currentUserId } : {}),
            };
          } else {
            // Add headers object as new argument
            args.push({
              headers: currentUserId ? { 'x-user-id': currentUserId } : {},
            });
          }
          return value.apply(target, args);
        };
      }
      if (typeof value === 'object' && value !== null) {
        return new Proxy(value, handler);
      }
      return value;
    },
  };

  return new Proxy(client, handler);
};

export const api = createApiProxy();

export const setCurrentUserId = (id: string | null) => {
  currentUserId = id;
  if (id) {
    localStorage.setItem('cavenet_user_id', id);
  } else {
    localStorage.removeItem('cavenet_user_id');
  }
};

export const getCurrentUserId = () => currentUserId;

/** Simple fetch wrapper for cases where eden typing is awkward */
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
