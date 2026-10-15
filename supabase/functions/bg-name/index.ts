// Admin-only: suggests the Bulgarian name of a LEGO set, as Bulgarian shops list it, so a new
// listing doesn't show Rebrickable's English name. Looks the set number up in Comsed's search
// (comsed.net, "LEGO® NINJAGO 71872 - Битка с ултрадракон"); retired sets usually aren't there.
//
// POST { "num": "71872-1" }  →  { "name": "Битка с ултрадракон" } or { "name": null }

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const caller = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: isAdmin } = await caller.rpc('is_admin');
  if (!isAdmin) return json({ error: 'Forbidden' }, 403);

  const { num } = (await req.json()) as { num?: string };
  // Shops use the bare number: 71872, not Rebrickable's 71872-1
  const setNum = (num ?? '').trim().replace(/-1$/, '');
  if (!/^\d{3,7}(-\d+)?$/.test(setNum)) return json({ error: 'Невалиден номер.' }, 400);

  try {
    const res = await fetch(`https://comsed.net/index.php?route=product/search&search=${encodeURIComponent(setNum)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TuhlenSvyat/1.0; +https://tuhlensvyat.com)' },
    });
    if (!res.ok) return json({ name: null });
    const html = await res.text();
    // Titles look like "LEGO® <line> <number> - <Bulgarian name>"
    const escaped = setNum.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = html.match(new RegExp(`LEGO®[^<>"]{0,40}?\\s${escaped}\\s-\\s([^<>"]{1,120})`));
    const name = match ? decodeEntities(match[1]).trim() : null;
    return json({ name: name || null });
  } catch {
    return json({ name: null });
  }
});
