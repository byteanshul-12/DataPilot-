import { createAuthClient } from "better-auth/react";

function resolveApiUrl(): string {
  const raw = import.meta.env.VITE_API_URL;

  // If VITE_API_URL is set and has a protocol, use it directly
  if (raw && raw.startsWith("http")) return raw;

  // If VITE_API_URL is a bare hostname (e.g. from Render's fromService), prepend https
  if (raw && raw.includes(".")) return `https://${raw}`;

  // Fallback: detect Render production by the running hostname
  if (typeof window !== "undefined" && window.location.hostname.includes("onrender.com")) {
    return "https://datapilot-backend-zywi.onrender.com";
  }

  return "http://localhost:8000";
}

const API_URL = resolveApiUrl();

export const authClient = createAuthClient({
  baseURL: API_URL,
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
} = authClient;