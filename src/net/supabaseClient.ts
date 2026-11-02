// Supabase 브라우저 클라이언트. URL·키는 Vite 환경 변수(공개 publishable/anon만).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function supabaseConfig(): { url: string; key: string } | null {
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || '';
  const key = (
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)
    || (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)
    || ''
  ).trim();
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ''), key };
}

export function hasSupabaseConfig(): boolean {
  return !!supabaseConfig();
}

/** 카카오 표지 Edge Function 기본 URL */
export function supabaseKakaoApiBase(): string {
  const cfg = supabaseConfig();
  return cfg ? `${cfg.url}/functions/v1` : '';
}

export function getSupabase(): SupabaseClient | null {
  const cfg = supabaseConfig();
  if (!cfg) return null;
  if (!client) {
    client = createClient(cfg.url, cfg.key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      realtime: { params: { eventsPerSecond: 12 } },
    });
  }
  return client;
}
