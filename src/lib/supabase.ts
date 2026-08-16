import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigured = Boolean(url && anonKey);

function readStoredAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key || !key.includes("auth-token")) continue;
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as {
        access_token?: string;
        currentSession?: { access_token?: string };
      };
      const token = parsed.access_token ?? parsed.currentSession?.access_token;
      if (typeof token === "string" && token.length > 0) return token;
    }
  } catch {
    return null;
  }
  return null;
}

let userAccessToken: string | null = readStoredAccessToken();

export function setUserAccessToken(token: string | null) {
  userAccessToken = token;
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

export const supabase = createClient(url ?? "https://placeholder.supabase.co", anonKey ?? "public-anon-key", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storage: typeof window === "undefined" ? undefined : window.localStorage,
  },
  global: {
    fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      const isAuthApi = requestUrl(input).includes("/auth/v1/");
      if (userAccessToken && !isAuthApi) {
        headers.set("Authorization", `Bearer ${userAccessToken}`);
      }
      return fetch(input, { ...init, headers });
    },
  },
});

if (supabaseConfigured) {
  supabase.auth.onAuthStateChange((_event, session) => {
    setUserAccessToken(session?.access_token ?? null);
  });
}
