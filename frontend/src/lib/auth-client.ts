import { createAuthClient } from "better-auth/react";

const rawApiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
const API_URL = rawApiUrl.startsWith("http") ? rawApiUrl : `https://${rawApiUrl}`;

export const authClient = createAuthClient({
  baseURL: API_URL,
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
} = authClient;