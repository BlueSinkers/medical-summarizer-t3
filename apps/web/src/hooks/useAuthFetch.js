import { useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";

export const clerkEnabled = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);

export function useAuthFetch() {
  const { getToken } = clerkEnabled ? useAuth() : {};

  return useCallback(
    async (url, options = {}) => {
      const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
      if (getToken) {
        try {
          const token = await getToken();
          if (token) headers["Authorization"] = `Bearer ${token}`;
        } catch {
          // token fetch failed; proceed as guest
        }
      }
      return fetch(url, { ...options, headers });
    },
    [getToken]
  );
}
