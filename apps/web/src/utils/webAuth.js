import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useWebAuth = create(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
    }),
    {
      name: 'traheeb-web-auth',
    }
  )
);

export async function authFetch(url, options = {}) {
  const token = useWebAuth.getState().token;
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };
  return fetch(url, { ...options, headers });
}
