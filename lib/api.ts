import { AuthResponse } from '@/types/auth';

interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
}

async function handleTokenRefresh(): Promise<boolean> {
  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include', // Important for cookies
    });

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }

    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error('Token refresh error:', error);
    return false;
  }
}

export async function fetchWithAuth(url: string, options: FetchOptions = {}): Promise<Response> {
  const { skipAuth = false, ...fetchOptions } = options;

  // If skipAuth is true, proceed with the fetch
  if (skipAuth) {
    return fetch(url, { ...fetchOptions, credentials: 'include' });
  }

  // First attempt
  let response = await fetch(url, {
    ...fetchOptions,
    credentials: 'include', // Important for cookies
  });

  // If unauthorized, try to refresh the token
  if (response.status === 401) {
    const refreshSuccess = await handleTokenRefresh();

    // If token refresh successful, retry the original request
    if (refreshSuccess) {
      response = await fetch(url, {
        ...fetchOptions,
        credentials: 'include',
      });
    } else {
      await handleLogout();
      throw new Error('Session expired. Please login again.');
    }
  }

  return response;
}

async function handleLogout() {
  try {
    // Call logout endpoint (handles both DB cleanup and cookie)
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });

    // Redirect to login
    const currentPath = window.location.pathname;
    window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
  } catch (error) {
    console.error('Logout error:', error);
    // Even if logout fails, redirect to login
    window.location.href = '/login';
  }
}

// Helper function for common API requests
export const api = {
  get: (url: string, options: FetchOptions = {}) =>
    fetchWithAuth(url, { ...options, method: 'GET' }),

  post: (url: string, data?: any, options: FetchOptions = {}) =>
    fetchWithAuth(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: JSON.stringify(data),
    }),

  put: (url: string, data?: any, options: FetchOptions = {}) =>
    fetchWithAuth(url, {
      ...options,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: JSON.stringify(data),
    }),

  delete: (url: string, options: FetchOptions = {}) =>
    fetchWithAuth(url, { ...options, method: 'DELETE' }),
};
